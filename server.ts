
import { extractMediaUrl } from "./services/mediaHelper";
import express from "express";

import { fetchPendingComments, updateScheduledCommentStatus, getAutoReplyConfig, supabase, fetchPostQueue, updatePostQueueStatus, scheduleComment, saveAutoReplyConfig } from "./services/supabaseService";
import { postComment, sendPrivateReply, postToFacebook } from "./services/facebookService";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const COMMENT_CHECK_INTERVAL = () => 45000 + Math.random() * 45000; // 45–90s aleatório (anti-padrão)

// Keep track of comments per page per day to protect from SPAM blocks
const dailyCommentTracker: Record<string, { date: string; count: number }> = {};
const DAILY_COMMENT_LIMIT = 15; // Max 15 comments per page per day

function checkAndIncrementCommentLimit(pageId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (!dailyCommentTracker[pageId] || dailyCommentTracker[pageId].date !== today) {
    dailyCommentTracker[pageId] = { date: today, count: 0 };
  }
  if (dailyCommentTracker[pageId].count >= DAILY_COMMENT_LIMIT) {
    return false;
  }
  dailyCommentTracker[pageId].count++;
  return true;
}

function parseSpintax(text: string): string {
  const spintaxPattern = /\{([^{}]+)\}/g;
  let matches = text.match(spintaxPattern);
  while (matches) {
    for (const match of matches) {
      const options = match.substring(1, match.length - 1).split('|');
      const chosen = options[Math.floor(Math.random() * options.length)];
      text = text.replace(match, chosen);
    }
    matches = text.match(spintaxPattern);
  }
  return text;
}

async function processComments() {
  const now = new Date();
  console.log(`[Comment Robot] ${now.toISOString()} - Checking for pending comments...`);
  
  try {
    const pending = await fetchPendingComments();
    if (pending.length === 0) return;

    console.log(`[Comment Robot] Found ${pending.length} pending comments to process.`);

    for (const comment of pending) {
      try {
        const schedTime = new Date(comment.scheduled_time);
        const diffSeconds = (now.getTime() - schedTime.getTime()) / 1000;
        
        // Wait at least 60 seconds after scheduled time to ensure post is stable
        if (diffSeconds < 60) {
          console.log(`[Comment Robot] Skipping comment for post ${comment.fb_post_id} - too early (${Math.round(diffSeconds)}s since scheduled)`);
          continue;
        }

        // LOCK: Atomic check to avoid duplicates. 
        // Only proceed if WE were the ones to successfully mark it as 'processing'.
        const lockAcquired = await updateScheduledCommentStatus(comment.id, 'processing');
        
        if (!lockAcquired) {
          console.log(`[Comment Robot] LOCK FAILED: Comment ${comment.id} already being processed by another instance.`);
          continue;
        }



        console.log(`[Comment Robot] Attempting to post comment for post ${comment.fb_post_id} (Attempt ${comment.attempts + 1})`);
        
        // Humanized Spintax parsing
        const processedText = parseSpintax(comment.comment_text);
        let res = await postComment(comment.access_token, comment.fb_post_id, processedText);
        
        if (res?.error && !comment.fb_post_id.includes('_')) {
           const alternativeId = `${comment.page_id}_${comment.fb_post_id}`;
           console.log(`[Comment Robot] Retrying with alternative ID: ${alternativeId}`);
           res = await postComment(comment.access_token, alternativeId, processedText);
        }

        if (res && !res.error) {
          console.log(`[Comment Robot] SUCCESS: Comment posted for post ${comment.fb_post_id}`);
          await updateScheduledCommentStatus(comment.id, 'completed');
        } else {
          const errorMsg = res?.error?.message || JSON.stringify(res?.error) || "Unknown error";
          const nextAttempt = (comment.attempts || 0) + 1;
          console.log(`[Comment Robot] FAIL: ${errorMsg} for post ${comment.fb_post_id}`);
          
          // Se for erro de SPAM/Rate Limit, esperar 1 hora para a próxima tentativa
          // Detecta tanto por código numérico (mais confiável) quanto por string de mensagem
          const errorCode = res?.error?.code;
          const isRateLimit = [4, 17, 32, 613, 368].includes(errorCode) ||
            errorMsg.toLowerCase().includes('frequência') ||
            errorMsg.toLowerCase().includes('spam') ||
            errorMsg.toLowerCase().includes('limit') ||
            errorMsg.toLowerCase().includes('rate');
          if (isRateLimit) {
            const baseMs = 60 * 60 * 1000 * Math.pow(2, comment.attempts || 0);
            const maxMs = 24 * 60 * 60 * 1000;
            const jitterMs = (Math.random() * 30 - 15) * 60 * 1000; // +/- 15 min
            const backoffMs = Math.max(10000, Math.min(baseMs, maxMs) + jitterMs);
            const retryTime = new Date(Date.now() + backoffMs);
            console.log(`[Comment Robot] Rate limit/SPAM detected. Rescheduling (Attempt ${nextAttempt}) for: ${retryTime.toISOString()} (backoff: ${Math.round(backoffMs / 1000 / 60)} min)`);
            await supabase.from('scheduled_comments')
              .update({ 
                status: 'pending', 
                attempts: nextAttempt,
                scheduled_time: retryTime.toISOString(),
                error_message: errorMsg
              })
              .eq('id', comment.id);
          } else if (nextAttempt >= 20) {
            await updateScheduledCommentStatus(comment.id, 'failed', `Max attempts reached: ${errorMsg}`, nextAttempt);
          } else {
            // Return to pending to try again later
            await updateScheduledCommentStatus(comment.id, 'pending', errorMsg, nextAttempt);
          }
        }
        // Delay maior entre postagens para evitar bloqueio por SPAM do Facebook
        await new Promise(r => setTimeout(r, 15000 + Math.random() * 30000)); // 15–45s aleatório
      } catch (e: any) {
        console.error(`[Comment Robot] CRITICAL ERROR for comment ${comment.id}:`, e.message);
        await updateScheduledCommentStatus(comment.id, 'failed', e.message, (comment.attempts || 0) + 1);
      }
    }
  } catch (err: any) {
    console.error("[Comment Robot] Error in background job:", err.message);
  } finally {
    setTimeout(processComments, COMMENT_CHECK_INTERVAL());
  }
}

// ==========================================
// BACKGROUND POST QUEUE PROCESSOR
// ==========================================
// Keep track of posts per page per day to respect spam limits
const dailyPostTracker: Record<string, { date: string; count: number }> = {};
const DAILY_POST_LIMIT = 10; // Max 10 posts per page per day

function checkAndIncrementPageLimit(pageId: string): boolean {
  // Limit disabled per user request
  return true;
}

const POST_QUEUE_INTERVAL = 10000; // 10 seconds

async function processPostQueue() {
  try {
    const queue = await fetchPostQueue();
    const pendingItems = queue.filter((i: any) => i.status === 'pending');
    
    if (pendingItems.length === 0) return;

    // Check Posting Window (Allowed only between 5h and 23h BRT / UTC-3)
    const brHour = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
    if (brHour >= 23 || brHour < 5) {
      console.log(`[PostQueue Robot] Fora do horário permitido (5h às 23h BRT). Processamento de posts suspenso.`);
      setTimeout(processPostQueue, POST_QUEUE_INTERVAL);
      return;
    }

    for (const item of pendingItems) {
      console.log(`[PostQueue] Starting processing for item: ${item.label} (${item.id})`);
      
      // LOCK: Atomic check to avoid duplicates.
      // Only proceed if WE were the ones to successfully mark it as 'processing'.
      const { data: lockData, error: lockError } = await supabase
        .from('post_queue')
        .update({ status: 'processing' })
        .eq('id', item.id)
        .eq('status', 'pending') // Only acquire if still pending
        .select();

      if (lockError || !lockData || lockData.length === 0) {
        console.log(`[PostQueue] LOCK FAILED: Item ${item.id} (${item.label}) already being processed by another instance.`);
        continue;
      }

      let currentProgress = item.progress_current || 0;
      let logs = [...(item.logs || [])];
      
      const logMsg = (msg: string) => {
        console.log(`[PostQueue] ${msg}`);
        logs.push(`${new Date().toLocaleTimeString()} - ${msg}`);
      };

      try {
        // Fetch media blobs from URLs
        const mediaBlobs: { blob: Blob; url?: string; description: string }[] = [];
        if (item.media_urls && item.media_urls.length > 0) {
          logMsg(`Downloading ${item.media_urls.length} media files...`);
          for (let i = 0; i < item.media_urls.length; i++) {
            const mediaItemRaw = item.media_urls[i];
            const extractedUrl = extractMediaUrl(mediaItemRaw);
            if (!extractedUrl) {
              throw new Error(`Media URL extraída é nula/inválida para o item raw na posição ${i}: ${JSON.stringify(mediaItemRaw)}`);
            }
            
            let mediaUrl = extractedUrl;
            let description = "";

            try {
              let parsed: any = null;
              if (typeof mediaItemRaw === 'string') {
                const cleanStr = mediaItemRaw.trim();
                if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                  parsed = JSON.parse(cleanStr);
                }
              } else if (typeof mediaItemRaw === 'object' && mediaItemRaw !== null) {
                parsed = mediaItemRaw;
              }
              if (parsed && parsed.description) {
                description = parsed.description;
              }
            } catch (e) {}

            logMsg(`Validando link da mídia via HEAD request: ${mediaUrl}`);
            try {
              const checkHead = await fetch(mediaUrl, { method: "HEAD" });
              if (!checkHead.ok) {
                logMsg(`[Warning] Servidor da mídia retornou status ${checkHead.status} para HEAD. Tentando download direto...`);
              } else {
                const contentType = checkHead.headers.get("content-type") || "";
                const contentLength = checkHead.headers.get("content-length") || "Desconhecido";
                logMsg(`Link validado com sucesso! Mimetype: ${contentType}, Size: ${contentLength} bytes`);
              }
            } catch (headErr: any) {
              logMsg(`[Aviso Pré-flight] Falha ao efetuar HEAD request (${headErr.message}). Prosseguindo com download direto...`);
            }

            console.log("[Stealth Debug] mediaItemRaw:", JSON.stringify(mediaItemRaw));
            console.log("[Stealth Debug] mediaUrl:", mediaUrl);

            const res = await fetch(mediaUrl);
            if (!res.ok) {
              throw new Error(`Falha no download da mídia (Status HTTP ${res.status}) para URL: ${mediaUrl}`);
            }
            const blob = await res.blob();
        mediaBlobs.push({ blob, url: mediaUrl, description });
          }
        }

        let totalSuccess = 0;
        let totalFailed = 0;

        // Auto-batching: split pages into groups of 5 pages to respect Meta security guidelines
        const chunkSize = 5;
        const pageChunks: any[][] = [];
        for (let i = 0; i < item.pages.length; i += chunkSize) {
          pageChunks.push(item.pages.slice(i, i + chunkSize));
        }

        for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
          const chunk = pageChunks[chunkIndex];
          logMsg(`Processando lote ${chunkIndex + 1} de ${pageChunks.length} (Contém ${chunk.length} páginas)...`);

          for (const page of chunk) {
            // Check if item was cancelled/deleted from queue in real-time by the user
            const { data: dbCheck } = await supabase
              .from('post_queue')
              .select('id')
              .eq('id', item.id)
              .maybeSingle();

            if (!dbCheck) {
              console.log(`[PostQueue] Item ${item.id} was deleted/cancelled by the user. Aborting deployments.`);
              break; // Immediately exit the page loop!
            }

            logMsg(`Deploying to ${page.name}...`);
            
            // Verify daily limit for the page
            if (!checkAndIncrementPageLimit(page.fb_id)) {
               logMsg(`[Stealth Warning] Daily limit of ${DAILY_POST_LIMIT} posts reached for page "${page.name}". Skipping to protect the account.`);
               totalFailed++;
               await updatePostQueueStatus(item.id, { logs });
               continue;
            }
            
            // update progress
            await updatePostQueueStatus(item.id, { logs });
            
             let scheduledTimeUnix: number | undefined = undefined;
             if (item.is_scheduled && item.scheduled_date) {
               let dateStr = item.scheduled_date;
               // Se a data vier do HTML datetime-local sem fuso horário, assumimos horário de Brasília (UTC-3)
               if (!dateStr.includes('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
                 dateStr += "-03:00";
               }
               scheduledTimeUnix = Math.floor(new Date(dateStr).getTime() / 1000);
               
               // Meta API safety check: if scheduled time is in the past or less than 10 minutes in the future,
               // convert it into an immediate live post to avoid Facebook rejecting it.
               const tenMinutesFromNow = Math.floor(Date.now() / 1000) + 10 * 60;
               if (scheduledTimeUnix < tenMinutesFromNow) {
                 logMsg(`[Stealth Redirect] O horário agendado (${new Date(dateStr).toLocaleString()}) está no passado ou muito próximo. Publicando IMEDIATAMENTE.`);
                 scheduledTimeUnix = undefined; // Null triggers an immediate post
               } else {
                 logMsg(`Post is scheduled for: ${new Date(dateStr).toLocaleString()} (Unix: ${scheduledTimeUnix})`);
               }
             }
 
             const res = await postToFacebook(
               page.access_token,
               page.fb_id,
               item.caption,
               mediaBlobs,
               scheduledTimeUnix,
               item.type,
               item.story_link
             );
 
             if (res.success) {
               logMsg(`[OK] Success on ${page.name}. ID: ${res.id}`);
               
               // Prevent duplicate scheduling: Check if comments have already been scheduled for this post ID
               const { data: existingComments } = await supabase
                 .from('scheduled_comments')
                 .select('id')
                 .eq('fb_post_id', res.id)
                 .limit(1);

               if (existingComments && existingComments.length > 0) {
                 logMsg(`[Stealth Guard] Comments already scheduled for post ${res.id} in a previous attempt. Skipping duplicate scheduling.`);
               } else if (item.comments && item.comments.length > 0) {
                 logMsg(`Scheduling ${item.comments.length} comments for ${page.name}...`);
                 let delaySecs = 0;
                 let baseTimeMs = Date.now();
                 
                 if (scheduledTimeUnix !== undefined) {
                    baseTimeMs = scheduledTimeUnix * 1000;
                  }
                  
                for (const c of item.comments) {
                  if (!c.text) continue;
                  delaySecs += (c.delay || 0);
                  
                  // Humanized offset: 90 to 240 seconds randomized offset per page
                  // to distribute comments across pages and mimic human activity.
                  const humanizedOffsetSecs = 90 + Math.floor(Math.random() * 150);
                  const totalDelaySecs = delaySecs + humanizedOffsetSecs;
                  
                  const schedTime = new Date(baseTimeMs + totalDelaySecs * 1000).toISOString();
                  logMsg(`Comment scheduled for ${page.name} with humanized offset of ${humanizedOffsetSecs}s (Total delay: ${totalDelaySecs}s)`);
                  
                  await scheduleComment({
                    page_id: page.fb_id,
                    access_token: page.access_token,
                    fb_post_id: res.id,
                    comment_text: parseSpintax(c.text),
                    scheduled_time: schedTime
                  });
                }
              }
              
              // Saving auto reply if any
              if (item.auto_reply_text) {
                 logMsg(`Saving auto-reply for ${page.name}...`);
                 await saveAutoReplyConfig(page.fb_id, res.id, item.auto_reply_text, page.access_token);
              }
  
              totalSuccess++;
            } else {
              logMsg(`[FAIL] Error on ${page.name}: ${res.error}`);
              totalFailed++;
            }
            currentProgress++;
            await updatePostQueueStatus(item.id, { progress_current: currentProgress, logs });
            
            // Anti-spam delay aleatorio dentro do lote: 5–15s
            await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000)); 
          }

          // Check if item was cancelled/deleted between batches
          const { data: dbCheckAfterChunk } = await supabase
            .from('post_queue')
            .select('id')
            .eq('id', item.id)
            .maybeSingle();
          if (!dbCheckAfterChunk) break;

          // Se houver mais lotes para rodar, faz uma pausa maior de segurança (5 a 10 minutos)
          if (chunkIndex < pageChunks.length - 1) {
            const batchWaitMin = 5 + Math.floor(Math.random() * 6); // 5–10 minutos
            logMsg(`Lote ${chunkIndex + 1} finalizado. Aguardando ${batchWaitMin} minutos de pausa de segurança antes de iniciar o próximo lote...`);
            await new Promise(r => setTimeout(r, batchWaitMin * 60 * 1000));
          }
        }

        const finalStatus = totalFailed === item.pages.length ? 'error' : 'done';
        logMsg(`Finished processing. Success: ${totalSuccess}, Failed: ${totalFailed}. Status -> ${finalStatus}`);
        
        await updatePostQueueStatus(item.id, { 
          status: finalStatus, 
          progress_current: currentProgress, 
          logs 
        });

      } catch (err: any) {
        const errorStack = err.stack || "No callstack available";
        const stackLines = errorStack.split('\n');
        const locationLine = stackLines.length > 1 ? stackLines[1].trim() : "Unknown file/line";
        
        logMsg(`[CRITICAL ERROR] Causa: ${err.message}`);
        logMsg(`[CRITICAL ERROR] Arquivo/Linha: ${locationLine}`);
        logMsg(`[CRITICAL ERROR] Stack completa:`);
        errorStack.split('\n').forEach((line: string) => logMsg(`  ${line}`));
        
        await updatePostQueueStatus(item.id, { status: 'error', logs });
      }
    }
  } catch (err: any) {
    console.error("[PostQueue] Error in processing queue:", err.message);
  } finally {
    setTimeout(processPostQueue, POST_QUEUE_INTERVAL);
  }
}

async function startServer() {
  const app = express();
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Facebook Webhook Verification
  app.get("/api/webhook/facebook", (req, res) => {
    const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "socialflow_secret_token";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("[Webhook] WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  // Facebook Webhook Event Receiver
  app.post("/api/webhook/facebook", express.json(), async (req, res) => {
    console.log("[Webhook] Received event, but webhook features are disabled per user request.");
    res.status(200).send("EVENT_RECEIVED_BUT_DEACTIVATED");
  });

  // Em dev, o Vite roda separado (porta 3000). O backend serve apenas as APIs (porta 3005).
  // Em produção, serve os arquivos estáticos do dist.
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    // SPA Fallback: serve index.html for any route not handled above
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  server.once('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Fatal] Port ${PORT} is already in use by another instance! Exiting to prevent duplicate robots.`);
      process.exit(1);
    } else {
      console.error('Server start error:', err);
      process.exit(1);
    }
  });

  server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Recovery system: Restore any stuck 'processing' items back to 'pending' on startup
    try {
      console.log("[PostQueue Recovery] Checking for stuck processing queue items...");
      const { data: recovered, error: recError } = await supabase
        .from('post_queue')
        .update({ 
          status: 'pending', 
          logs: ['System reboot/crash recovery initialized. Resetted item to pending.'] 
        })
        .eq('status', 'processing')
        .select();

      if (recError) {
        console.error("[PostQueue Recovery] Supabase recovery query returned error:", recError.message);
      } else if (recovered && recovered.length > 0) {
        console.log(`[PostQueue Recovery] Successfully recovered ${recovered.length} stuck post(s) to pending!`);
      } else {
        console.log("[PostQueue Recovery] No stuck items found. All clear!");
      }
    } catch (recErr: any) {
      console.error("[PostQueue Recovery] Failed to execute recovery routine:", recErr.message);
    }

    console.log("[Comment Robot] Starting orchestration...");
    processComments();
    console.log("[PostQueue Robot] Starting queue processor...");
    processPostQueue();
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch(err => {
  console.error("CRITICAL ERROR DURING SERVER STARTUP:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Anti-Crash] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Anti-Crash] Uncaught Exception thrown:", err);
});
