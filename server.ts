
import express from "express";

import { fetchPendingComments, updateScheduledCommentStatus, getAutoReplyConfig } from "./services/supabaseService";
import { postComment, sendPrivateReply } from "./services/facebookService";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const COMMENT_CHECK_INTERVAL = 30000; // 30 seconds

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
        
        let res = await postComment(comment.access_token, comment.fb_post_id, comment.comment_text);
        
        if (res?.error && !comment.fb_post_id.includes('_')) {
           const alternativeId = `${comment.page_id}_${comment.fb_post_id}`;
           console.log(`[Comment Robot] Retrying with alternative ID: ${alternativeId}`);
           res = await postComment(comment.access_token, alternativeId, comment.comment_text);
        }

        if (res && !res.error) {
          console.log(`[Comment Robot] SUCCESS: Comment posted for post ${comment.fb_post_id}`);
          await updateScheduledCommentStatus(comment.id, 'completed');
        } else {
          const errorMsg = res?.error?.message || JSON.stringify(res?.error) || "Unknown error";
          console.log(`[Comment Robot] FAIL: ${errorMsg} for post ${comment.fb_post_id}`);
          
          const nextAttempt = (comment.attempts || 0) + 1;
          if (nextAttempt >= 20) {
            await updateScheduledCommentStatus(comment.id, 'failed', `Max attempts reached: ${errorMsg}`, nextAttempt);
          } else {
            // Return to pending to try again later
            await updateScheduledCommentStatus(comment.id, 'pending', errorMsg, nextAttempt);
          }
        }
        // Small delay between posts to be nice to FB API
        await new Promise(r => setTimeout(r, 3000));
      } catch (e: any) {
        console.error(`[Comment Robot] CRITICAL ERROR for comment ${comment.id}:`, e.message);
        await updateScheduledCommentStatus(comment.id, 'failed', e.message, (comment.attempts || 0) + 1);
      }
    }
  } catch (err: any) {
    console.error("[Comment Robot] Error in background job:", err.message);
  } finally {
    setTimeout(processComments, COMMENT_CHECK_INTERVAL);
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
    const body = req.body;

    if (body.object === "page") {
      res.status(200).send("EVENT_RECEIVED");

      for (const entry of body.entry) {
        // 1. Process Feed Changes (Comments)
        if (entry.changes) {
          for (const event of entry.changes) {
            if (event.field === "feed" && event.value.item === "comment" && event.value.verb === "add") {
              try {
                const fullPostId = event.value.post_id;
                const pageId = fullPostId.split('_')[0];
                const commentId = event.value.comment_id;

                console.log(`[Webhook] New comment: ${fullPostId}`);

                let config = await getAutoReplyConfig(fullPostId, pageId);
                
                if (config && config.reply_text) {
                  console.log(`[Webhook] Target Page: ${pageId}, Comment: ${commentId}, Token: ${config.access_token?.substring(0, 10)}...`);
                  const replyRes = await sendPrivateReply(commentId, config.reply_text, config.access_token);
                  if (replyRes && !replyRes.error) {
                    console.log(`[Webhook] SUCCESS: Private reply sent.`);
                  } else {
                    console.error(`[Webhook] ERROR sending reply to page ${pageId}:`, replyRes?.error);
                  }
                }
              } catch (err: any) {
                console.error("[Webhook] Comment Error:", err.message);
              }
            }
          }
        }

        // 2. Process Messenger Messaging (SIM Flow)
        if (entry.messaging) {
          for (const msgEvent of entry.messaging) {
            if (msgEvent.message && msgEvent.message.text) {
              try {
                const senderId = msgEvent.sender.id;
                const pageId = msgEvent.recipient.id;
                const text = msgEvent.message.text.toUpperCase();

                console.log(`[Webhook] Message from ${senderId} on page ${pageId}: ${text}`);

                if (text.includes("SIM")) {
                  console.log(`[Webhook] 'SIM' detected! Sending recipe card...`);
                  
                  const { data: configs } = await supabase
                    .from('post_auto_replies')
                    .select('access_token')
                    .eq('page_id', pageId)
                    .limit(1);

                  const token = configs?.[0]?.access_token;
                  if (token) {
                    const cardPayload = {
                      recipient: { id: senderId },
                      message: {
                        attachment: {
                          type: "template",
                          payload: {
                            template_type: "generic",
                            elements: [{
                              title: "Sua receita chegou! 🍳",
                              image_url: "https://receitasdivinosabor.com.br/wp-content/uploads/2023/04/receita-bolo-maracuja.jpg",
                              subtitle: "Clique no botão abaixo para ver o passo a passo completo.",
                              buttons: [{
                                type: "web_url",
                                url: "https://social-flow-oo9e.onrender.com",
                                title: "Ver Receita Completa"
                              }]
                            }]
                          }
                        }
                      }
                    };

                    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${token}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(cardPayload)
                    });
                    console.log("[Webhook] Card sent successfully!");
                  }
                }
              } catch (e: any) {
                console.error("[Webhook] Messaging Error:", e.message);
              }
            }
          }
        }
      }
    } else {
      res.sendStatus(404);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    // SPA Fallback: serve index.html for any route not handled above
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("[Comment Robot] Starting orchestration...");
    processComments();
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
