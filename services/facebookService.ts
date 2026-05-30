
import { FacebookPage } from '../types';

const FB_GRAPH_URL = 'https://graph.facebook.com/v18.0';


const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export const cleanToken = (token: string): string => token.replace(/\s/g, '').trim();

/**
 * Redimensiona a imagem para 1080x1920 (9:16 EXATO) para Stories ou mantém proporção.
 */
export const createUniqueImageHash = async (file: File, force916: boolean = false): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }

        if (force916) {
          canvas.width = 1080;
          canvas.height = 1920;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, 1080, 1920);
          const imgRatio = img.width / img.height;
          const targetRatio = 1080 / 1920;
          let drawW, drawH, drawX, drawY;
          if (imgRatio > targetRatio) {
            drawW = 1080; drawH = 1080 / imgRatio; drawX = 0; drawY = (1920 - drawH) / 2;
          } else {
            drawH = 1920; drawW = 1920 * imgRatio; drawX = (1080 - drawW) / 2; drawY = 0;
          }
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }

        ctx.fillStyle = `rgba(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, 0.005)`;
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 3, 3);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(new Blob([blob], { type: 'image/jpeg' }));
          else resolve(file);
        }, 'image/jpeg', 0.92);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const createUniqueBinaryHash = async (file: File): Promise<Blob> => {
  const buffer = await file.arrayBuffer();
  const view = new Uint8Array(buffer);
  const newBuffer = new Uint8Array(view.length + 1);
  newBuffer.set(view);
  newBuffer[view.length] = Math.floor(Math.random() * 256);
  return new Blob([newBuffer], { type: file.type });
};

export const validateTokenAndFetchPages = async (token: string) => {
  try {
    const meRes = await fetch(`${FB_GRAPH_URL}/me?fields=name,id&access_token=${token}`);
    const meData = await meRes.json();
    if (meData.error) throw new Error(meData.error.message);

    const debugRes = await fetch(`${FB_GRAPH_URL}/me/permissions?access_token=${token}`);
    const debugData = await debugRes.json();

    // If /me/permissions returns an error, this is a PAGE token (not user token).
    // Page tokens don't support this endpoint — skip permissions check entirely.
    const isPageToken = !!(debugData.error);
    const permissions = isPageToken ? [] : (debugData.data || []).filter((p: any) => p.status === 'granted').map((p: any) => p.permission);
    
    console.log(isPageToken ? "[Service] Page token detected — skipping permissions check." : "[Service] Granted Permissions:", permissions);
    
    const requiredPermissions = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging', 'pages_manage_metadata'];
    // For page tokens, skip the missing check since they don't expose /me/permissions
    const missing = isPageToken ? [] : requiredPermissions.filter(p => !permissions.includes(p));

    let pages: any[] = [];
    let nextUrl: string | null = `${FB_GRAPH_URL}/me/accounts?fields=name,access_token,id,picture&limit=100&access_token=${token}`;
    
    // Suporte a paginação para buscar TODAS as páginas da conta (sem limite de 100)
    while (nextUrl) {
      try {
        const pagesRes = await fetch(nextUrl);
        const pagesData = await pagesRes.json();
        if (pagesData.error) throw new Error(pagesData.error.message);

        if (pagesData.data && pagesData.data.length > 0) {
          const mapped = pagesData.data.map((p: any) => ({
            fb_id: p.id, 
            name: p.name, 
            access_token: p.access_token,
            picture: p.picture?.data?.url || ""
          }));
          pages.push(...mapped);
        }
        
        nextUrl = pagesData.paging?.next || null;
      } catch (err: any) {
        console.error("[Service] Erro ao paginar páginas do Facebook:", err.message);
        nextUrl = null;
      }
    }

    // Caso o token seja de uma PÁGINA individual (Fallback)
    if (pages.length === 0) {
      try {
        const checkPageRes = await fetch(`${FB_GRAPH_URL}/${meData.id}?fields=name,access_token,picture&access_token=${token}`);
        const p = await checkPageRes.json();
        
        // Se p.access_token não vier (comum em tokens de página consultando a si mesmos),
        // usamos o próprio token fornecido, pois ele é o token da página!
        const tokenToUse = p.access_token || token;
        
        if (p.id && tokenToUse) {
           pages.push({
             fb_id: p.id,
             name: p.name,
             access_token: tokenToUse,
             picture: p.picture?.data?.url || ""
           });
        }
      } catch (err) {}
    }

    return { 
      isValid: true, 
      pages, 
      userName: meData.name, 
      error: missing.length > 0 ? `Atenção: Faltam permissões (${missing.join(', ')}). Algumas funções podem falhar.` : undefined 
    };
  } catch (e: any) { 
    return { isValid: false, pages: [], error: e.message }; 
  }
};

export const fetchPageMetrics = async (pageId: string, token: string) => {
  try {
    const res = await fetch(`${FB_GRAPH_URL}/${pageId}?fields=fan_count,talking_about_count,name,picture&access_token=${token}`);
    const data = await res.json();
    if (data.error) {
      console.error(`[fetchPageMetrics] Graph API Error for page ${pageId}:`, data.error.message || data.error);
      return { error: true, errorDetails: data.error.message || JSON.stringify(data.error) };
    }
    try {
      const insightsRes = await fetch(`${FB_GRAPH_URL}/${pageId}/insights?metric=page_impressions_unique,page_engaged_users&period=day&access_token=${token}`);
      const insightsData = await insightsRes.json();
      const reach = insightsData.data?.find((i: any) => i.name === 'page_impressions_unique')?.values?.[0]?.value || 0;
      const engaged = insightsData.data?.find((i: any) => i.name === 'page_engaged_users')?.values?.[0]?.value || 0;
      return { 
        ...data, 
        reach: reach * 7, 
        engaged: engaged || data.talking_about_count || 0,
        picture: data.picture?.data?.url || ""
      };
    } catch (e) {
      return { 
        ...data, 
        reach: (data.fan_count || 0) * 0.15, 
        engaged: data.talking_about_count || 0,
        picture: data.picture?.data?.url || ""
      };
    }
  } catch (e: any) { 
    console.error(`[fetchPageMetrics] Fetch exception for page ${pageId}:`, e.message);
    return { error: true, errorDetails: e.message }; 
  }
};

const sanitizeUrl = (url: string) => {
  if (!url) return null;
  let clean = url.trim();
  if (!clean.startsWith('http')) clean = 'https://' + clean;
  try { return new URL(clean).toString(); } catch { return null; }
};

export const postToFacebook = async (
  token: string,
  pageId: string,
  caption: string,
  media: { blob: Blob; description: string }[],
  scheduledTime?: number,
  type: 'ALBUM' | 'SINGLE' | 'VIDEO' | 'STORY' = 'ALBUM',
  storyLink?: string,
  retries: number = 2
): Promise<{ success: boolean; id?: string; error?: string; code?: number }> => {
  try {
    let responseData: any;
    let effectiveType = type;
    if (type === 'SINGLE' && media[0]?.blob && media[0].blob.type.startsWith('video')) {
      effectiveType = 'VIDEO';
    }
    if (type === 'VIDEO' && media[0]?.blob && !media[0].blob.type.startsWith('video')) {
      effectiveType = media.length > 1 ? 'ALBUM' : 'SINGLE';
    }

    if (effectiveType === 'STORY') {
      const isVideo = media[0].blob.type.startsWith('video');
      const endpoint = isVideo ? 'video_stories' : 'photo_stories';
      const fileKey = isVideo ? 'video' : 'photo';
      const formData = new FormData();
      formData.append(fileKey, media[0].blob, isVideo ? 'story.mp4' : 'story.jpg');
      if (storyLink) {
        const cleanLink = sanitizeUrl(storyLink);
        if (cleanLink) formData.append('link', cleanLink);
      }
      const res = await fetch(`${FB_GRAPH_URL}/${pageId}/${endpoint}?access_token=${token}`, { method: 'POST', body: formData });
      responseData = await res.json();
    } else if (effectiveType === 'VIDEO') {
      const fd = new FormData();
      fd.append('access_token', token);
      fd.append('source', media[0].blob, 'video.mp4');
      fd.append('description', caption);
      if (scheduledTime) {
        fd.append('scheduled_publish_time', scheduledTime.toString());
        fd.append('published', '0');
      }
      const res = await fetch(`${FB_GRAPH_URL}/${pageId}/videos`, { method: 'POST', body: fd });
      responseData = await res.json();
    } else if (effectiveType === 'SINGLE') {
      const fd = new FormData();
      fd.append('access_token', token);
      fd.append('source', media[0].blob, 'photo.jpg');
      fd.append('caption', caption);
      if (scheduledTime) {
        fd.append('scheduled_publish_time', scheduledTime.toString());
        fd.append('published', '0');
      }
      const res = await fetch(`${FB_GRAPH_URL}/${pageId}/photos`, { method: 'POST', body: fd });
      responseData = await res.json();
    } else {
      const mediaIds = [];
      for (const m of media) {
        const fd = new FormData();
        fd.append('access_token', token);
        fd.append('source', m.blob, 'item.jpg');
        fd.append('caption', m.description || "");
        fd.append('published', '0');
        const res = await fetch(`${FB_GRAPH_URL}/${pageId}/photos`, { method: 'POST', body: fd });
        const d = await res.json();
        if (d.id) mediaIds.push(d.id);
      }
      const feedFd = new FormData();
      feedFd.append('access_token', token);
      feedFd.append('message', caption);
      feedFd.append('attached_media', JSON.stringify(mediaIds.map(id => ({ media_fbid: id }))));
      if (scheduledTime) {
        feedFd.append('scheduled_publish_time', scheduledTime.toString());
        feedFd.append('published', '0');
      }
      const finalRes = await fetch(`${FB_GRAPH_URL}/${pageId}/feed`, { method: 'POST', body: feedFd });
      responseData = await finalRes.json();
    }

    if (responseData.error) {
      if (retries > 0 && (responseData.error.code === 1 || responseData.error.code === 2)) {
        await wait(3000);
        return postToFacebook(token, pageId, caption, media, scheduledTime, type, storyLink, retries - 1);
      }
      return { success: false, error: responseData.error.message, code: responseData.error.code };
    }
    return { success: true, id: responseData.id || responseData.post_id };
  } catch (e: any) {
    return { success: false, error: e.message, code: e.code };
  }
};

export const postComment = async (token: string, postId: string, message: string) => {
  try {
    // Tenta extrair a primeira URL para forçar a prévia de link (link preview) no Facebook
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = message.match(urlRegex);
    let extractedUrl = match ? match[0] : null;
    
    if (extractedUrl) {
      // Remove pontuações finais capturadas incorretamente
      extractedUrl = extractedUrl.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]+$/, "");
      try {
        new URL(extractedUrl); // Validação de segurança
      } catch (e) {
        extractedUrl = null;
      }
    }

    // Se houver uma URL, fazemos o scrape prévio no Facebook
    // para garantir que os metadados (título, descrição, imagem) estejam cacheados
    if (extractedUrl) {
      try {
        console.log(`[Facebook API] Forçando scrape da URL: ${extractedUrl}`);
        const scrapeUrl = `${FB_GRAPH_URL}/?id=${encodeURIComponent(extractedUrl)}&scrape=true&access_token=${token}`;
        const scrapeRes = await fetch(scrapeUrl, { method: 'POST' });
        const scrapeData = await scrapeRes.json();
        console.log(`[Facebook API] Scrape finalizado:`, JSON.stringify(scrapeData));
      } catch (scrapeErr: any) {
        console.warn("[Facebook API] Falha no scrape prévio (ignorando):", scrapeErr.message);
      }
    }

    const url = `${FB_GRAPH_URL}/${postId}/comments`;
    const fd = new FormData();
    fd.append('access_token', token);
    fd.append('message', message);
    if (extractedUrl) {
      fd.append('attachment_share_url', extractedUrl);
    }

    const res = await fetch(url, { method: 'POST', body: fd });
    return await res.json();
  } catch (e: any) { 
    return { error: { message: e.message, code: e.code } }; 
  }
};

export const fetchPageConversations = async (pageId: string, token: string) => {
  try {
    const fields = 'participants{name,id,email},messages{message,from,created_time},updated_time';
    const res = await fetch(`${FB_GRAPH_URL}/${pageId}/conversations?fields=${fields}&access_token=${token}`);
    const data = await res.json();
    return data.data || [];
  } catch (e) { return []; }
};

export const sendMessageToPSID = async (pageId: string, recipientPsid: string, text: string, token: string) => {
  try {
    const body = {
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: 'MESSAGE_TAG',
      tag: 'ACCOUNT_UPDATE'
    };
    const res = await fetch(`${FB_GRAPH_URL}/${pageId}/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e: any) { return { error: { message: e.message } }; }
};

export const fetchLeadProfile = async (psid: string, token: string) => {
  try {
    const res = await fetch(`${FB_GRAPH_URL}/${psid}?fields=name,profile_pic&access_token=${token}`);
    return await res.json();
  } catch (e) { return { name: 'Lead do Messenger', profile_pic: '' }; }
};

/**
 * Busca posts recentes da página para monitorar comentários
 */
export const fetchRecentPosts = async (pageId: string, token: string) => {
  try {
    const res = await fetch(`${FB_GRAPH_URL}/${pageId}/feed?fields=id,message,created_time&limit=5&access_token=${token}`);
    const data = await res.json();
    return data.data || [];
  } catch (e) { return []; }
};

/**
 * Busca comentários de um post específico
 */
export const fetchPostComments = async (postId: string, token: string) => {
  try {
    const res = await fetch(`${FB_GRAPH_URL}/${postId}/comments?fields=from,message,created_time,id&access_token=${token}`);
    const data = await res.json();
    return data.data || [];
  } catch (e) { return []; }
};

/**
 * Envia uma resposta no Direct para quem comentou (Private Reply)
 */
export const sendPrivateReply = async (commentId: string, text: string, token: string, pageId?: string) => {
  try {
    console.log(`[Service] Attempting private reply to: ${commentId} using token ${token.substring(0, 10)}...`);
    
    // A partir da Graph API v18+, a forma recomendada de enviar Private Replies 
    // é usando o endpoint de Messages da Página passando o comment_id como recipient.
    const finalPageId = pageId || (commentId.includes('_') ? commentId.split('_')[0] : null);

    if (finalPageId) {
      const messagesUrl = `${FB_GRAPH_URL}/${finalPageId}/messages?access_token=${token}`;
      const payload = {
        recipient: { comment_id: commentId },
        message: { text: text }
      };

      console.log(`[Service] Using Messages API for Private Reply. Page: ${finalPageId}, Comment: ${commentId}`);
      let res = await fetch(messagesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = await res.json();
      
      if (!data.error) {
        return data;
      }
      console.warn(`[Service] Messages API failed (${data.error.message}), trying fallback...`);
    }

    // Fallback: Tenta o endpoint antigo (private_replies)
    const fallbackUrl = `${FB_GRAPH_URL}/${commentId}/private_replies?message=${encodeURIComponent(text)}&access_token=${token}`;
    console.log(`[Service] Falling back to old private_replies endpoint...`);
    let fallbackRes = await fetch(fallbackUrl, { method: 'POST' });
    let fallbackData = await fallbackRes.json();
    
    // Se der erro 100 e tiver "_", tenta apenas o ID numérico final
    if (fallbackData.error && fallbackData.error.code === 100 && commentId.includes('_')) {
      const parts = commentId.split('_');
      const numericId = parts[parts.length - 1];
      console.log(`[Service] Old endpoint failed, retrying with numeric ID: ${numericId}`);
      
      const retryUrl = `${FB_GRAPH_URL}/${numericId}/private_replies?message=${encodeURIComponent(text)}&access_token=${token}`;
      const retryRes = await fetch(retryUrl, { method: 'POST' });
      return await retryRes.json();
    }

    return fallbackData;
  } catch (e: any) { 
    return { error: { message: e.message } }; 
  }
};
/**
 * Assina a página nos Webhooks do App (Obrigatório para receber notificações)
 */
export const subscribePageToWebhook = async (pageId: string, accessToken: string) => {
  try {
    const fields = 'feed,messages,messaging_postbacks,messaging_optins,message_deliveries';
    const url = `${FB_GRAPH_URL}/${pageId}/subscribed_apps?subscribed_fields=${fields}&access_token=${accessToken}`;
    const res = await fetch(url, { method: 'POST' });
    return await res.json();
  } catch (e: any) { 
    return { error: { message: e.message } }; 
  }
};
