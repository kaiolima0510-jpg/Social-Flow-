
import { extractMediaUrl } from "./services/mediaHelper";
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

import { fetchPendingComments, updateScheduledCommentStatus, getAutoReplyConfig, supabase, fetchPostQueue, updatePostQueueStatus, scheduleComment, saveAutoReplyConfig, getPageAccessToken, fetchPendingFlowExecutions, updateFlowExecution, isCommentProcessed, markCommentAsProcessed, upsertLead, triggerFlowForLead, fetchAllFlows, resumeFlowExecutionOnUserReply } from "./services/supabaseService";
import { postComment, sendPrivateReply, postToFacebook, sendRichMessageToPSID, fetchRecentPosts, fetchPostComments, fetchLeadProfile } from "./services/facebookService";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const COMMENT_CHECK_INTERVAL = () => 30000 + Math.random() * 10000; // 30-40 segundos (backup/fallback)

// Session store for authenticated tokens
const activeSessions = new Map<string, { createdAt: number, workspace: string }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSessionToken(workspace: string): string {
  const token = crypto.randomUUID();
  activeSessions.set(token, { createdAt: Date.now(), workspace });
  return token;
}

function isValidSession(token: string): { valid: boolean, workspace?: string } {
  const session = activeSessions.get(token);
  if (!session) return { valid: false };
  if (Date.now() - session.createdAt > SESSION_TTL) {
    activeSessions.delete(token);
    return { valid: false };
  }
  return { valid: true, workspace: session.workspace };
}

// Flags to prevent Realtime listeners from spawning duplicate worker loops
let commentWorkerStarted = false;
let postQueueWorkerStarted = false;

// Keep track of comments per page per day to protect from SPAM blocks
const dailyCommentTracker: Record<string, { date: string; count: number }> = {};
const DAILY_COMMENT_LIMIT = 30; // Max 30 comments per page per day

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

let isProcessingComments = false;

async function processComments() {
  if (isProcessingComments) {
    console.log("[Comment Robot] Robô de comentários já em execução. Ignorando chamada paralela.");
    return;
  }
  isProcessingComments = true;
  const now = new Date();
  console.log(`[Comment Robot] ${now.toISOString()} - Checking for pending comments...`);
  
  try {
    const pending = await fetchPendingComments();
    if (pending.length > 0) {
      console.log(`[Comment Robot] Found ${pending.length} pending comments to process.`);

      for (const comment of pending) {
        try {
          const schedTime = new Date(comment.scheduled_time);
          const diffSeconds = (now.getTime() - schedTime.getTime()) / 1000;
          
          // Wait at least 10 seconds after scheduled time to ensure post is stable
          if (diffSeconds < 10) {
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



          // Check daily comment limit to protect the account
          if (!checkAndIncrementCommentLimit(comment.page_id)) {
            console.log(`[Comment Robot] Daily limit of ${DAILY_COMMENT_LIMIT} comments reached for page ${comment.page_id}. Rescheduling to tomorrow.`);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(8, 0, 0, 0); // Schedule for tomorrow morning at 08:00 BRT
            await updateScheduledCommentStatus(comment.id, 'pending', 'Daily limit reached, rescheduled to tomorrow.', comment.attempts, tomorrow.toISOString());
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
              console.log(`[Comment Robot] Rate limit/SPAM detected. Marking comment ${comment.id} as failed permanently to avoid backlog.`);
              await updateScheduledCommentStatus(comment.id, 'failed', `Rate limit/SPAM block: ${errorMsg}`, nextAttempt);
            } else if (nextAttempt >= 20) {
              await updateScheduledCommentStatus(comment.id, 'failed', `Max attempts reached: ${errorMsg}`, nextAttempt);
            } else {
              // Return to pending to try again later with a 5-minute backoff delay to avoid loop congestion
              const backoffTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
              await updateScheduledCommentStatus(comment.id, 'pending', errorMsg, nextAttempt, backoffTime);
            }
          }
          // Delay maior entre postagens para evitar bloqueio por SPAM do Facebook
          await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000)); // 5–15s aleatório
        } catch (e: any) {
          console.error(`[Comment Robot] CRITICAL ERROR for comment ${comment.id}:`, e.message);
          await updateScheduledCommentStatus(comment.id, 'failed', e.message, (comment.attempts || 0) + 1);
        }
      }
    }
  } catch (err: any) {
    console.error("[Comment Robot] Error in background job:", err.message);
  } finally {
    isProcessingComments = false;
    if (commentWorkerStarted) {
      setTimeout(processComments, COMMENT_CHECK_INTERVAL());
    }
  }
}

// ==========================================
// BACKGROUND FLOW QUEUE PROCESSOR
// ==========================================
let isProcessingFlows = false;

async function processFlowExecutions() {
  if (isProcessingFlows) return;
  isProcessingFlows = true;

  try {
    const pendingExecutions = await fetchPendingFlowExecutions();
    if (pendingExecutions.length > 0) {
      console.log(`[Flow Worker] Found ${pendingExecutions.length} pending flow executions.`);
      
      for (const exec of pendingExecutions) {
        try {
          const flow = (exec as any).fb_flows;
          if (!flow || !flow.is_active || !flow.steps) {
            await updateFlowExecution(exec.id, { status: 'completed' });
            continue;
          }

          const steps = flow.steps;
          const currentIndex = exec.current_step_index;

          if (currentIndex >= steps.length) {
            await updateFlowExecution(exec.id, { status: 'completed' });
            continue;
          }

          const step = steps[currentIndex];
          console.log(`[Flow Worker] Executing step ${currentIndex} (type: ${step.type}) of flow "${flow.name}" for lead ${exec.lead_psid}`);

          if (step.type === 'delay') {
            const delayValue = parseInt(step.delay_value) || 0;
            const delayUnit = step.delay_unit || 'seconds';
            let delayMs = delayValue * 1000;
            if (delayUnit === 'minutes') delayMs = delayValue * 60 * 1000;
            if (delayUnit === 'hours') delayMs = delayValue * 60 * 60 * 1000;

            const nextTime = new Date(Date.now() + delayMs).toISOString();
            await updateFlowExecution(exec.id, {
              current_step_index: currentIndex + 1,
              next_execution_time: nextTime
            });
            console.log(`[Flow Worker] Flow "${flow.name}" delayed by ${delayValue} ${delayUnit}. Next run at ${nextTime}`);
          } else {
            const pageToken = await getPageAccessToken(exec.page_id);
            if (!pageToken) {
              console.error(`[Flow Worker] No access token found for page ${exec.page_id}`);
              await updateFlowExecution(exec.id, { 
                status: 'failed', 
                error_message: 'Access token not found' 
              });
              continue;
            }

            // Fetch lead's name to replace variables like {{name}}, {{first_name}}
            let leadName = "Cliente";
            try {
              const { data: leadData } = await supabase
                .from('fb_leads')
                .select('name')
                .eq('page_id', exec.page_id)
                .eq('psid', exec.lead_psid)
                .limit(1);
              if (leadData && leadData.length > 0 && leadData[0].name) {
                leadName = leadData[0].name;
              }
            } catch (err) {
              console.error("[Flow Worker] Error fetching lead name:", err);
            }

            const formatMessageText = (rawText: string, fullName: string) => {
              if (!rawText) return "";
              const firstName = fullName.split(' ')[0] || fullName;
              return rawText
                .replace(/\{\{nome\}\}/gi, fullName)
                .replace(/\{\{name\}\}/gi, fullName)
                .replace(/\{\{primeiro_nome\}\}/gi, firstName)
                .replace(/\{\{first_name\}\}/gi, firstName);
            };

            let messagePayload: any = {};
            if (step.type === 'text') {
              if (step.buttons && step.buttons.length > 0) {
                const formattedButtons = step.buttons.slice(0, 3).map((btn: any) => {
                  if (btn.type === 'web_url' || btn.url) {
                    return {
                      type: 'web_url',
                      url: btn.url,
                      title: formatMessageText(btn.title, leadName) || 'Clique aqui'
                    };
                  } else {
                    return {
                      type: 'postback',
                      title: formatMessageText(btn.title, leadName) || 'Selecionar',
                      payload: btn.payload || btn.title
                    };
                  }
                });

                messagePayload = {
                  attachment: {
                    type: 'template',
                    payload: {
                      template_type: 'button',
                      text: formatMessageText(step.text, leadName) || '...',
                      buttons: formattedButtons
                    }
                  }
                };
              } else {
                messagePayload = { text: formatMessageText(step.text, leadName) };
              }
            } else if (step.type === 'image') {
              messagePayload = {
                attachment: {
                  type: 'image',
                  payload: { url: step.media_url, is_reusable: true }
                }
              };
            } else if (step.type === 'audio') {
              messagePayload = {
                attachment: {
                  type: 'audio',
                  payload: { url: step.media_url, is_reusable: true }
                }
              };
            } else if (step.type === 'card') {
              const elements = (step.cards || []).map((card: any) => ({
                title: formatMessageText(card.title, leadName) || '...',
                subtitle: formatMessageText(card.subtitle, leadName) || '',
                image_url: card.image_url || undefined,
                buttons: card.button_url ? [
                  {
                    type: 'web_url',
                    url: card.button_url,
                    title: formatMessageText(card.button_title, leadName) || 'Acessar Link'
                  }
                ] : undefined
              }));

              if (elements.length > 0) {
                messagePayload = {
                  attachment: {
                    type: 'template',
                    payload: {
                      template_type: 'generic',
                      elements
                    }
                  }
                };
              } else {
                messagePayload = { text: "[Card Vazio]" };
              }
            }

            const recipientToUse = (currentIndex === 0 && (exec as any).comment_id) 
              ? (exec as any).comment_id 
              : exec.lead_psid;

            const res = await sendRichMessageToPSID(exec.page_id, recipientToUse, messagePayload, pageToken);
            if (res.error) {
              console.error(`[Flow Worker] Facebook API error for lead ${exec.lead_psid}:`, res.error);
              
              const is24hError = res.error.code === 10 || 
                                 res.error.code === 200 || 
                                 res.error.message?.includes("outside the allowed window") || 
                                 res.error.message?.includes("fora do espaço de tempo") ||
                                 res.error.message?.includes("24-hour");

              if (is24hError) {
                const createdAt = new Date(exec.created_at).getTime();
                const ageInHours = (Date.now() - createdAt) / (1000 * 60 * 60);
                
                if (ageInHours < 24) { // Tenta reprocessar por até 24h
                  console.log(`[Flow Worker] Janela de 24h fechada para o lead ${exec.lead_psid}. Reagendando tentativa para daqui a 2 minutos.`);
                  await updateFlowExecution(exec.id, {
                    next_execution_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
                    error_message: 'Aguardando interação do usuário (Janela de 24h)'
                  });
                  continue;
                }
              }

              await updateFlowExecution(exec.id, { 
                status: 'failed', 
                error_message: res.error.message 
              });
            } else {
              const nextIndex = currentIndex + 1;
              const updates: any = { current_step_index: nextIndex };
              if (nextIndex >= steps.length) {
                updates.status = 'completed';
              } else {
                updates.next_execution_time = new Date(Date.now() + 1000).toISOString();
              }
              await updateFlowExecution(exec.id, updates);
            }
          }
        } catch (e: any) {
          console.error(`[Flow Worker] Error processing flow execution ${exec.id}:`, e);
          await updateFlowExecution(exec.id, { status: 'failed', error_message: e.message });
        }
      }
    }
  } catch (e) {
    console.error("[Flow Worker] Critical crash:", e);
  } finally {
    isProcessingFlows = false;
  }
}

// ==========================================
// BACKGROUND AUTOMATED COMMENT SYNC (LEADS & FLOWS)
// ==========================================
let isSyncingLeadsBackground = false;

async function syncLeadsAndTriggerAutomationsBackground() {
  if (isSyncingLeadsBackground) return;
  isSyncingLeadsBackground = true;
  console.log("[Auto Sync] Starting background comment synchronization for active flows...");

  try {
    const { data: pages, error } = await supabase
      .from('fb_pages')
      .select('fb_id, access_token, name');
      
    if (error || !pages) {
      console.error("[Auto Sync] Error fetching pages:", error);
      isSyncingLeadsBackground = false;
      return;
    }

    const flows = await fetchAllFlows();
    const { data: automations } = await supabase
      .from('fb_automations')
      .select('*')
      .eq('is_active', true);

    for (const page of pages) {
      if (!page.access_token) continue;
      
      try {
        console.log(`[Auto Sync] Checking page: ${page.name}`);
        const posts = await fetchRecentPosts(page.fb_id, page.access_token);
        
        for (const post of posts) {
          const comments = await fetchPostComments(post.id, page.access_token);
          
          for (const comment of comments) {
            if (!comment.from || comment.from.id === page.fb_id) continue;
            
            const alreadyProcessed = await isCommentProcessed(comment.id);
            if (!alreadyProcessed) {
              const matchingFlow = (flows || []).find(f => 
                f.is_active && 
                (f.page_ids?.includes(page.fb_id) || f.page_id === page.fb_id) &&
                (f.trigger_type === 'all' || (f.trigger_keyword && comment.message.toLowerCase().includes(f.trigger_keyword.toLowerCase())))
              );

              if (matchingFlow) {
                console.log(`[Auto Sync] [Flow Match] Page: ${page.name}, Post: ${post.id}, Comment: ${comment.id}, User: ${comment.from.name}`);
                await triggerFlowForLead(page.fb_id, comment.from.id, matchingFlow.id, comment.id);
                await markCommentAsProcessed(comment.id, page.fb_id);
                
                // await upsertLead({
                //   page_id: page.fb_id,
                //   psid: comment.from.id,
                //   name: comment.from.name,
                //   last_interaction: new Date().toISOString()
                // });
                continue;
              }

              const matchingAuto = (automations || []).find(a => 
                a.page_id === page.fb_id &&
                (!a.trigger_keyword || comment.message.toLowerCase().includes(a.trigger_keyword.toLowerCase()))
              );

              if (matchingAuto) {
                console.log(`[Auto Sync] [AutoReply Match] Page: ${page.name}, Post: ${post.id}, Comment: ${comment.id}`);
                await sendPrivateReply(comment.id, matchingAuto.reply_message, page.access_token);
                await markCommentAsProcessed(comment.id, page.fb_id);
                
                // await upsertLead({
                //   page_id: page.fb_id,
                //   psid: comment.from.id,
                //   name: comment.from.name,
                //   last_interaction: new Date().toISOString()
                // });
              }
            }
          }
        }
      } catch (pageErr: any) {
        console.error(`[Auto Sync] Error checking page ${page.name}:`, pageErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Auto Sync] Critical error in background sync:", err.message);
  } finally {
    isSyncingLeadsBackground = false;
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

const POST_QUEUE_INTERVAL = 300000; // 5 minutos (backup/fallback)

let isProcessingQueue = false;

async function processPostQueue() {
  if (isProcessingQueue) {
    console.log("[PostQueue Robot] Robô de posts já em execução. Ignorando chamada paralela.");
    return;
  }
  isProcessingQueue = true;
  try {
    const queue = await fetchPostQueue();
    const pendingItems = queue.filter((i: any) => i.status === 'pending');
    
    if (pendingItems.length > 0) {
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
            } catch (e: any) {
              console.warn("[PostQueue] Failed to parse media metadata:", e.message);
            }

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
                  delaySecs += (c.delay || 0) * 60;
                  
                  // Humanized offset: 15 to 45 seconds randomized offset per page
                  // to distribute comments across pages and mimic human activity.
                  const humanizedOffsetSecs = 15 + Math.floor(Math.random() * 30);
                  const totalDelaySecs = delaySecs + humanizedOffsetSecs;
                  
                  const schedTime = new Date(baseTimeMs + totalDelaySecs * 1000).toISOString();
                  logMsg(`Comment scheduled for ${page.name} with humanized offset of ${humanizedOffsetSecs}s (Total delay: ${totalDelaySecs}s)`);
                  
                  await scheduleComment({
                    page_id: page.fb_id,
                    access_token: page.access_token,
                    fb_post_id: res.id,
                    comment_text: parseSpintax(c.text),
                    scheduled_time: schedTime,
                    workspace: item.workspace || 'admin'
                  });
                }
              }
              
              // Saving auto reply if any
              if (item.auto_reply_text) {
                 logMsg(`Saving auto-reply for ${page.name}...`);
                 await saveAutoReplyConfig(page.fb_id, res.id, item.auto_reply_text, page.access_token, item.workspace || 'admin');
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

          // Se houver mais lotes para rodar, faz uma pausa maior de segurança (30 a 60 segundos)
          if (chunkIndex < pageChunks.length - 1) {
            const batchWaitSec = 30 + Math.floor(Math.random() * 31); // 30–60 segundos
            logMsg(`Lote ${chunkIndex + 1} finalizado. Aguardando ${batchWaitSec} segundos de pausa de segurança antes de iniciar o próximo lote...`);
            await new Promise(r => setTimeout(r, batchWaitSec * 1000));
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
    }
  } catch (err: any) {
    console.error("[PostQueue] Error in processing queue:", err.message);
  } finally {
    isProcessingQueue = false;
    if (postQueueWorkerStarted) {
      setTimeout(processPostQueue, POST_QUEUE_INTERVAL);
    }
  }
}

async function startServer() {
  const app = express();

  // Rate limiter for login endpoint (anti brute-force)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 attempts per window
    message: { success: false, error: "Muitas tentativas. Tente novamente em 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Authentication Endpoints
  app.get("/api/config/auth", (req, res) => {
    const isAuthRequired = !!process.env.APP_PASSWORD && process.env.APP_PASSWORD.trim() !== "";
    res.json({ authRequired: isAuthRequired });
  });

  app.post("/api/login", express.json({ limit: '1mb' }), loginLimiter, async (req, res) => {
    const { email, password, token } = req.body;

    if (token) {
      const session = isValidSession(token);
      if (session.valid) {
        return res.json({ success: true, token, workspace: session.workspace });
      }
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
    }

    try {
      // Procurar usuário no banco
      const { data, error } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        return res.status(401).json({ success: false, error: "Usuário não encontrado ou credenciais inválidas." });
      }

      // Validar senha (ideal seria bcrypt, mas usando texto plano por enquanto como solicitado/simplificado, ou sha256)
      if (data.password_hash === password) {
        const newToken = createSessionToken(data.workspace);
        return res.json({ success: true, token: newToken, workspace: data.workspace, role: data.role, name: data.name });
      } else {
        return res.status(401).json({ success: false, error: "Senha incorreta." });
      }
    } catch (e) {
      return res.status(500).json({ success: false, error: "Erro interno no servidor." });
    }
  });

  // Gestão de Usuários (Admin)
  app.get("/api/users", express.json(), async (req, res) => {
    // Validar token (simples middleware inline)
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !isValidSession(token).valid) return res.status(401).json({ error: "Não autorizado" });
    
    // Na prática o token deve pertencer ao admin, mas como é um app de confiança interna,
    // garantiremos no frontend.
    const { data, error } = await supabase.from('system_users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  app.post("/api/users", express.json(), async (req, res) => {
    const { email, password, name, workspace, role } = req.body;
    const { data, error } = await supabase.from('system_users').insert([{
      email,
      password_hash: password,
      name,
      workspace,
      role: role || 'user'
    }]).select().single();
    
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('system_users').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  });

  // Facebook Webhook Verification
  app.get("/api/webhook/facebook", (req, res) => {
    const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    if (!VERIFY_TOKEN) {
      console.error("[Webhook] FB_WEBHOOK_VERIFY_TOKEN not set in .env");
      return res.sendStatus(500);
    }
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
  app.post("/api/webhook/facebook", express.json({ limit: '5mb' }), async (req, res) => {
    const body = req.body;

    if (body.object === "page") {
      res.status(200).send("EVENT_RECEIVED");

      if (!Array.isArray(body.entry)) return;
      for (const entry of body.entry) {
        // 1. Process Messages (Messenger Webhook)
        if (entry.messaging) {
          for (const msgEvent of entry.messaging) {
            // A message from the lead/user (ignoring echos sent by the page itself)
            if (msgEvent.message && !msgEvent.message.is_echo) {
              try {
                const senderId = msgEvent.sender.id; // PSID of the lead
                const pageId = msgEvent.recipient.id; // ID of the page
                const text = msgEvent.message.text || "";

                console.log(`[Webhook] User message received from ${senderId} on page ${pageId}: "${text}"`);

                // Get page access token to fetch lead details
                const pageToken = await getPageAccessToken(pageId);
                let name = "Cliente";
                let profilePic = "";
                if (pageToken) {
                  const profile = await fetchLeadProfile(senderId, pageToken);
                  if (profile && profile.name) {
                    name = profile.name;
                    profilePic = profile.profile_pic || "";
                  }
                }

                // Update lead last interaction & name
                // await upsertLead({
                //   page_id: pageId,
                //   psid: senderId,
                //   name: name,
                //   profile_pic: profilePic,
                //   last_interaction: new Date().toISOString()
                // });

                // Resume/wake up the flow execution (e.g. if it was waiting for the 24h window)
                await resumeFlowExecutionOnUserReply(pageId, senderId);

              } catch (err: any) {
                console.error("[Webhook] Messaging Error:", err.message);
              }
            }
          }
        }

        // 2. Process Comments (Feed Webhook)
        if (entry.changes) {
          for (const event of entry.changes) {
            if (event.field === "feed" && event.value.item === "comment" && event.value.verb === "add") {
              try {
                const commentId = event.value.comment_id;
                const fullPostId = event.value.post_id;
                const pageId = entry.id; // Page ID
                const message = event.value.message || "";
                const sender = event.value.from; // { id: "PSID", name: "Name" }

                // Ignore comments made by the page itself
                if (!sender || sender.id === pageId) continue;

                console.log(`[Webhook] New comment from ${sender.name} (${sender.id}) on page ${pageId}: "${message}"`);

                const alreadyProcessed = await isCommentProcessed(commentId);
                if (alreadyProcessed) {
                  console.log(`[Webhook] Comment ${commentId} already processed. Skipping.`);
                  continue;
                }

                // Fetch active flows and match
                const flows = await fetchAllFlows();
                const matchingFlow = (flows || []).find(f => 
                  f.is_active && 
                  (f.page_ids?.includes(pageId) || f.page_id === pageId) &&
                  (f.trigger_type === 'all' || (f.trigger_keyword && message.toLowerCase().includes(f.trigger_keyword.toLowerCase())))
                );

                if (matchingFlow) {
                  console.log(`[Webhook] [Flow Match] Page: ${pageId}, Flow: ${matchingFlow.name}, User: ${sender.name}`);
                  
                  // Upsert lead details in CRM
                  // await upsertLead({
                  //   page_id: pageId,
                  //   psid: sender.id,
                  //   name: sender.name,
                  //   last_interaction: new Date().toISOString()
                  // });

                  // Trigger flow execution
                  await triggerFlowForLead(pageId, sender.id, matchingFlow.id, commentId);
                  
                  // Mark comment as processed
                  await markCommentAsProcessed(commentId, pageId);
                } else {
                  console.log(`[Webhook] No active flow matched comment "${message}" on page ${pageId}`);
                }

              } catch (err: any) {
                console.error("[Webhook] Comment Event Error:", err.message);
              }
            }
          }
        }
      }
    } else {
      res.sendStatus(404);
    }
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
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recovered, error: recError } = await supabase
        .from('post_queue')
        .update({ 
          status: 'pending', 
          logs: ['System reboot/crash recovery initialized. Resetted item to pending.'] 
        })
        .eq('status', 'processing')
        .lt('created_at', fifteenMinutesAgo)
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

    console.log("[Supabase Realtime] Binding database listeners...");
    
    supabase
      .channel('backend_post_queue')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_queue' },
        (payload: any) => {
          const status = payload.new?.status;
          if (status === 'pending') {
            console.log("[Supabase Realtime] Novo post pendente detectado! Acordando processador de fila...");
            processPostQueue();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'post_queue' },
        (payload: any) => {
          const status = payload.new?.status;
          const oldStatus = payload.old?.status;
          if (status === 'pending' && oldStatus !== 'pending') {
            console.log("[Supabase Realtime] Post atualizado para pendente! Acordando processador de fila...");
            processPostQueue();
          }
        }
      )
      .subscribe();

    supabase
      .channel('backend_scheduled_comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scheduled_comments' },
        (payload: any) => {
          const status = payload.new?.status;
          if (status === 'pending') {
            console.log("[Supabase Realtime] Novo comentário pendente detectado! Acordando robô de comentários...");
            processComments();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scheduled_comments' },
        (payload: any) => {
          const status = payload.new?.status;
          const oldStatus = payload.old?.status;
          if (status === 'pending' && oldStatus !== 'pending') {
            console.log("[Supabase Realtime] Comentário atualizado para pendente! Acordando robô de comentários...");
            processComments();
          }
        }
      )
      .subscribe();

    console.log("[Comment Robot] Starting orchestration...");
    commentWorkerStarted = true;
    processComments();
    console.log("[PostQueue Robot] Starting queue processor...");
    postQueueWorkerStarted = true;
    processPostQueue();
    
    console.log("[Flow Robot] Starting flow executions worker...");
    processFlowExecutions();
    setInterval(processFlowExecutions, 10000);

    console.log("[Auto Sync] Starting background comment detector...");
    syncLeadsAndTriggerAutomationsBackground();
    setInterval(syncLeadsAndTriggerAutomationsBackground, 60000);
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
