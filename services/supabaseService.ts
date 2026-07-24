
import { createClient } from '@supabase/supabase-js';
import { Lead, Message, PageGroup } from '../types';

// Robust environment variable loading for both Vite and Node
const getEnv = (name: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (name === 'VITE_SUPABASE_URL') return import.meta.env.VITE_SUPABASE_URL;
    if (name === 'VITE_SUPABASE_ANON_KEY') return import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (name === 'PORT') return import.meta.env.PORT;
    if (name === 'VITE_BACKEND_URL') return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.warn("SUPABASE CONFIG MISSING: Verifique seu arquivo .env e o prefixo VITE_");
} else {
  console.log("SUPABASE CONFIG LOADED:", {
    url: supabaseUrl.substring(0, 12) + "...",
    key: supabaseKey.substring(0, 8) + "..."
  });
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export const fetchAccountsFromCloud = async () => {
  try {
    // Tentamos buscar primeiro em fb_pages, que é onde o usuário confirmou que os dados estão.
    const { data: pagesData, error: pagesError } = await supabase.from('fb_pages').select('*');
    
    if (!pagesError && pagesData && pagesData.length > 0) {
      // Agrupamos as páginas por account_id para manter a compatibilidade com a UI
      const accountsMap: Record<string, any> = {};
      
      pagesData.forEach(page => {
        if (!page) return;

        const accId = page.account_id || 'default';
        if (!accountsMap[accId]) {
          accountsMap[accId] = {
            id: accId,
            name: page.name || "Perfil Conectado", // Usa o nome da primeira página como base
            token: page.access_token || "",
            pages: []
          };
        }
        
        accountsMap[accId].pages.push({
          fb_id: page.fb_id || page.id || "unknown",
          name: page.name || "Página sem Nome",
          access_token: page.access_token || "",
          category: page.category || "General"
        });

        // Se tiver só uma página, garante que o nome do card seja o nome da página
        if (accountsMap[accId].pages.length === 1) {
          accountsMap[accId].name = accountsMap[accId].pages[0].name;
        }
      });
      
      return Object.values(accountsMap);
    }

    const { data, error } = await supabase.from('fb_accounts').select('*');
    if (error) {
      console.error("fetchAccountsFromCloud Error:", error);
      return [];
    }
    
    return (data || []).map(row => {
      if (row.pages && Array.isArray(row.pages)) return row;
      
      // Legacy/Alternative schema support:
      // If the row itself represents a page:
      return {
        id: row.id,
        name: row.group_name || row.name || "Perfil Conectado",
        token: row.token,
        last_sync: row.last_sync || row.created_at,
        pages: [
          {
            fb_id: row.id, // Or another field if ID is not the FB ID
            name: row.name,
            access_token: row.token
          }
        ]
      };
    });
  } catch (e) {
    console.error("fetchAccountsFromCloud Crash:", e);
    return [];
  }
};

export const deleteAccountFromCloud = async (id: string) => {
  console.log(`[Supabase] Attempting to delete account/page with id: ${id}`);
  
  if (id === 'default') {
    const { error } = await supabase.from('fb_pages').delete().is('account_id', null);
    if (error) throw new Error(error.message);
  } else {
    // Tenta deletar se o id for o account_id em fb_pages
    const { error: e1 } = await supabase.from('fb_pages').delete().eq('account_id', id);
    if (e1) console.error("Error deleting by account_id:", e1);
    
    // Tenta deletar se o id for diretamente o id da pagina ou o fb_id em fb_pages
    const { error: e2 } = await supabase.from('fb_pages').delete().eq('fb_id', id);
    if (e2) console.error("Error deleting by fb_id:", e2);
    
    const { error: e3 } = await supabase.from('fb_pages').delete().eq('id', id);
    if (e3) console.error("Error deleting by id:", e3);
  }
  
  // Tenta deletar da tabela legada fb_accounts
  const { error: e4 } = await supabase.from('fb_accounts').delete().eq('id', id);
  if (e4) console.error("Error deleting from fb_accounts:", e4);
};

export const saveFullAccount = async (acc: { name: string, token: string, pages: any[] }) => {
  try {
    // 1. Gera um accountId estável a partir do token (hash simples) ou usa um existente
    const { data: existingPages } = await supabase
      .from('fb_pages')
      .select('account_id')
      .limit(1);
      
    // Se não há páginas no banco ainda, cria um novo account_id. Senão, reutiliza o existente
    // para manter todas as páginas do mesmo usuário agrupadas.
    const accountId = existingPages?.[0]?.account_id || crypto.randomUUID();
    console.log(`[Supabase] Usando account_id: ${accountId}`);

    const pagesToInsert = acc.pages.map(p => ({
      account_id: accountId,
      fb_id: p.fb_id,
      name: p.name,
      access_token: p.access_token,
      category: p.category || ""
    })).filter(p => !!p.access_token);

    if (pagesToInsert.length === 0) {
      console.warn('[Supabase] Nenhuma página com access_token válido para salvar.');
      return;
    }

    for (const page of pagesToInsert) {
      // 2. Verifica se a página com esse fb_id já existe na base
      const { data: existing, error: fetchError } = await supabase
        .from('fb_pages')
        .select('id')
        .eq('fb_id', page.fb_id)
        .maybeSingle();

      if (fetchError) {
        console.error(`[Supabase] Erro ao buscar página ${page.fb_id}:`, fetchError);
      }

      if (existing) {
        // 3. Se existe, atualiza os dados da página
        console.log(`[Supabase] Atualizando página existente: ${page.name} (${page.fb_id})`);
        const { error: updateError } = await supabase
          .from('fb_pages')
          .update({
            name: page.name,
            access_token: page.access_token,
            category: page.category
          })
          .eq('fb_id', page.fb_id);
        
        if (updateError) {
          console.error(`[Supabase] Erro ao atualizar página ${page.fb_id}:`, updateError);
          throw new Error(updateError.message);
        }
      } else {
        // 4. Se não existe, insere a nova página com UUID próprio
        console.log(`[Supabase] Inserindo nova página: ${page.name} (${page.fb_id})`);
        const { error: insertError } = await supabase
          .from('fb_pages')
          .insert({
            id: crypto.randomUUID(),
            account_id: page.account_id,
            fb_id: page.fb_id,
            name: page.name,
            access_token: page.access_token,
            category: page.category
          });
        
        if (insertError) {
          console.error(`[Supabase] Erro ao inserir nova página ${page.fb_id}:`, insertError);
          throw new Error(insertError.message);
        }
      }
    }

    return { id: accountId, name: acc.name };
  } catch (err: any) {
    console.error("Error in saveFullAccount:", err);
    throw new Error(`Erro no Banco: ${err.message}`);
  }
};

export const logPostHistory = async (post: any) => {
  const { data } = await supabase
    .from('post_history')
    .insert({
      main_caption: post.main_caption,
      first_comment: post.first_comment,
      target_group: post.target_group,
      post_type: post.post_type,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  return data?.id;
};

export const logPublication = async (historyId: string, pageId: string, status: string, error: string, fbPostId?: string, aiScore: number = 0) => {
  await supabase.from('publications').insert({
    history_id: historyId,
    page_id: pageId,
    status,
    error_message: error,
    fb_post_id: fbPostId,
    ai_score: aiScore
  });
};

export const logPageMetrics = async (pageId: string, metrics: any) => {
  await supabase.from('page_metrics').insert({
    page_id: pageId,
    fans: metrics.fans,
    reach: metrics.reach,
    engagement: metrics.engagement
  });
};

/**
 * OPTIMIZED: Fetches all stats for multiple pages in bulk
 */
export const fetchAllPagesStatsSummary = async (pageIds: string[]) => {
  if (!pageIds || pageIds.length === 0) return {};

  try {
    // 1. Fetch all publications for these pages
    const { data: allPubs, error: pubsError } = await supabase
      .from('publications')
      .select('page_id, status, created_at')
      .in('page_id', pageIds)
      .order('created_at', { ascending: false });

    if (pubsError) console.warn("publications table might be missing or empty:", pubsError.message);

    // 2. Fetch latest metrics for these pages
    const { data: allMetrics, error: metricsError } = await supabase
      .from('page_metrics')
      .select('page_id, fans')
      .in('page_id', pageIds)
      .order('created_at', { ascending: false });

    if (metricsError) console.warn("page_metrics table might be missing or empty:", metricsError.message);

    const stats: Record<string, any> = {};

    pageIds.forEach(id => {
      const pagePubs = allPubs?.filter(p => p.page_id === id) || [];
      const successCount = pagePubs.filter(p => p.status === 'success').length;
      const total = pagePubs.length;
      const latestFanEntry = allMetrics?.find(m => m.page_id === id);

      stats[id] = {
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
        tokens: total,
        lastPost: pagePubs[0]?.created_at || null,
        fans: latestFanEntry?.fans || 0
      };
    });

    return stats;
  } catch (e) {
    console.error("fetchAllPagesStatsSummary Crash:", e);
    return {};
  }
};

export const fetchPageGroups = async (): Promise<PageGroup[]> => {
  try {
    const { data, error } = await supabase.from('page_groups').select('*');
    if (error) {
      console.error("fetchPageGroups Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const savePageGroup = async (name: string, pageIds: string[]) => {
  const { data, error } = await supabase
    .from('page_groups')
    .insert({ name, page_ids: pageIds })
    .select()
    .single();
    
  if (error) {
    console.error("Error saving page group:", error);
    return { id: crypto.randomUUID(), name, page_ids: pageIds }; // Fallback local
  }
  return data;
};

export const deletePageGroup = async (id: string) => {
  await supabase.from('page_groups').delete().eq('id', id);
};

export const scheduleComment = async (comment: any) => {
  await supabase.from('scheduled_comments').insert({
    page_id: comment.page_id,
    access_token: comment.access_token,
    fb_post_id: comment.fb_post_id,
    comment_text: comment.comment_text,
    scheduled_time: comment.scheduled_time,
    status: 'pending'
  });
};

export const fetchScheduledCommentsSummary = async () => {
  try {
    const { data, error } = await supabase
      .from('scheduled_comments')
      .select('*')
      .order('scheduled_time', { ascending: true });
    if (error) {
      console.error("fetchScheduledCommentsSummary Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const fetchPendingComments = async () => {
  try {
    const nowStr = new Date().toISOString();
    const { data, error } = await supabase
      .from('scheduled_comments')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', nowStr)
      .order('scheduled_time', { ascending: true })
      .limit(100);
    if (error) {
      console.error("Error fetching pending comments:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const updateScheduledCommentStatus = async (
  id: string, 
  status: 'completed' | 'failed' | 'pending' | 'processing', 
  error_log?: string, 
  attempts?: number,
  next_scheduled_time?: string
) => {
  const updateData: any = { 
    status
  };
  
  if (attempts !== undefined) updateData.attempts = attempts;
  if (error_log !== undefined) updateData.error_message = error_log;
  if (next_scheduled_time !== undefined) updateData.scheduled_time = next_scheduled_time;

  // Se estamos tentando travar como 'processing', fazemos uma checagem atômica
  if (status === 'processing') {
    const { data, error } = await supabase
      .from('scheduled_comments')
      .update(updateData)
      .eq('id', id)
      .eq('status', 'pending') // SÓ trava se ainda estiver pendente
      .select();
    
    if (error) console.error("Erro na trava atômica:", error);
    return !!(data && data.length > 0);
  }

  // Para outros status, atualização normal
  const { error } = await supabase
    .from('scheduled_comments')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error("Erro ao atualizar status do comentario agendado:", error);
  }
  return !error;
};

export const saveAutoReplyConfig = async (pageId: string, fbPostId: string, replyText: string, token: string) => {
  const { error } = await supabase
    .from('post_auto_replies')
    .insert({
      page_id: pageId,
      fb_post_id: fbPostId,
      reply_text: replyText,
      access_token: token
    });
  if (error) {
    console.error("Erro ao salvar config de auto-reply:", error);
  }
};

export const getAutoReplyConfig = async (fbPostId: string, pageId?: string) => {
  // 1. Try exact match with fbPostId
  const { data, error } = await supabase
    .from('post_auto_replies')
    .select('*')
    .eq('fb_post_id', fbPostId)
    .single();
  
  if (!error && data) {
    return data;
  }

  // 2. If not found and we have a pageId, try fallback by page_id
  if (pageId) {
    const { data: pageConfigs } = await supabase
      .from('post_auto_replies')
      .select('*')
      .eq('page_id', pageId)
      .limit(1);
    
    if (pageConfigs && pageConfigs.length > 0) {
      return pageConfigs[0];
    }
  }

  return null;
};

// CRM / LEADS
export const upsertLead = async (lead: Partial<Lead>) => {
  const { data, error } = await supabase
    .from('fb_leads')
    .upsert({
      page_id: lead.page_id,
      psid: lead.psid,
      name: lead.name,
      profile_pic: lead.profile_pic,
      last_interaction: lead.last_interaction || new Date().toISOString()
    }, { onConflict: 'page_id,psid' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchLeadsByPage = async (pageId: string): Promise<Lead[]> => {
  try {
    const { data, error } = await supabase
      .from('fb_leads')
      .select('*')
      .eq('page_id', pageId)
      .order('last_interaction', { ascending: false });
    if (error) {
      console.error("fetchLeadsByPage Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const saveMessageLog = async (msg: Partial<Message>) => {
  const { error } = await supabase.from('fb_messages').insert({
    lead_id: msg.lead_id,
    sender_id: msg.sender_id,
    text: msg.text
  });
  if (error) throw error;
};

export const fetchMessagesByLead = async (leadId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from('fb_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error("fetchMessagesByLead Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

// AUTOMATIONS
export const fetchAutomationsByPage = async (pageId: string) => {
  try {
    const { data, error } = await supabase
      .from('fb_automations')
      .select('*')
      .eq('page_id', pageId);
    if (error) {
      console.error("fetchAutomationsByPage Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const saveAutomation = async (automation: any) => {
  const { data, error } = await supabase
    .from('fb_automations')
    .upsert(automation)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteAutomation = async (id: string) => {
  const { error } = await supabase.from('fb_automations').delete().eq('id', id);
  if (error) throw error;
};

export const getPageAccessToken = async (pageId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('fb_pages')
      .select('access_token')
      .eq('fb_id', pageId)
      .maybeSingle();
      
    if (error || !data) return null;
    return data.access_token;
  } catch (e) {
    return null;
  }
};

// FLOWS
export const fetchAllFlows = async () => {
  try {
    const { data, error } = await supabase
      .from('fb_flows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error("fetchAllFlows Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const fetchFlowsByPage = async (pageId: string) => {
  try {
    const { data, error } = await supabase
      .from('fb_flows')
      .select('*')
      .or(`page_id.eq.${pageId},page_ids.cs.["${pageId}"]`)
      .order('created_at', { ascending: false });
    if (error) {
      console.error("fetchFlowsByPage Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const saveFlow = async (flow: any) => {
  const { data, error } = await supabase
    .from('fb_flows')
    .upsert(flow)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteFlow = async (id: string) => {
  const { error } = await supabase.from('fb_flows').delete().eq('id', id);
  if (error) throw error;
};

export const triggerFlowForLead = async (pageId: string, psid: string, flowId: string, commentId?: string) => {
  try {
    const { data: existing } = await supabase
      .from('fb_flow_executions')
      .select('id')
      .eq('lead_psid', psid)
      .eq('flow_id', flowId)
      .eq('status', 'running')
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const { data, error } = await supabase
      .from('fb_flow_executions')
      .insert({
        page_id: pageId,
        lead_psid: psid,
        flow_id: flowId,
        comment_id: commentId || null,
        current_step_index: 0,
        status: 'running',
        next_execution_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error("triggerFlowForLead Error:", e);
    return null;
  }
};

export const fetchPendingFlowExecutions = async () => {
  try {
    const { data, error } = await supabase
      .from('fb_flow_executions')
      .select('*, fb_flows(*)')
      .eq('status', 'running')
      .lte('next_execution_time', new Date().toISOString());

    if (error) {
      console.error("fetchPendingFlowExecutions Error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

export const updateFlowExecution = async (id: string, updates: any) => {
  try {
    const { data, error } = await supabase
      .from('fb_flow_executions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error("updateFlowExecution Error:", e);
    return null;
  }
};

export const resumeFlowExecutionOnUserReply = async (pageId: string, leadPsid: string) => {
  try {
    const { data: executions, error } = await supabase
      .from('fb_flow_executions')
      .select('id')
      .eq('page_id', pageId)
      .eq('lead_psid', leadPsid)
      .eq('status', 'running');

    if (error) throw error;
    if (executions && executions.length > 0) {
      for (const exec of executions) {
        await supabase
          .from('fb_flow_executions')
          .update({
            next_execution_time: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', exec.id);
        console.log(`[Supabase Service] Wake up/resume flow execution ${exec.id} for lead ${leadPsid}`);
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("resumeFlowExecutionOnUserReply Error:", e);
    return false;
  }
};


export const isCommentProcessed = async (commentId: string) => {
  try {
    const { data } = await supabase
      .from('fb_processed_comments')
      .select('comment_id')
      .eq('comment_id', commentId);
    return data && data.length > 0;
  } catch (e) {
    return false;
  }
};

export const markCommentAsProcessed = async (commentId: string, pageId: string) => {
  await supabase.from('fb_processed_comments').insert({ comment_id: commentId, page_id: pageId });
};

export const fetchTotalLeadsCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('fb_leads')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error("fetchTotalLeadsCount Error:", e);
    return 0;
  }
};

// ==========================================
// BACKGROUND QUEUE & MEDIA SYSTEM
// ==========================================

export const uploadMediaToStorage = async (file: File): Promise<{ url: string | null; error: string | null }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `post_media/${fileName}`;

    const { data, error } = await supabase.storage
      .from('media')
      .upload(filePath, file, { cacheControl: '31536000, immutable', upsert: false });

    if (error) {
      console.error("Storage upload error:", error);
      return { url: null, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (e: any) {
    console.error("Crash on uploadMediaToStorage:", e);
    return { url: null, error: e?.message ?? 'Erro desconhecido' };
  }
};

export const savePostQueue = async (item: any) => {
  const { data, error } = await supabase
    .from('post_queue')
    .insert([{
      status: item.status,
      label: item.label,
      type: item.type,
      caption: item.caption,
      comments: item.comments,
      auto_reply_text: item.autoReplyText,
      story_link: item.storyLink,
      is_scheduled: item.isScheduled,
      scheduled_date: item.scheduledDate || null,
      use_ai: item.useAI,
      pages: item.pages,
      media_urls: item.mediaUrls,
      progress_current: item.progress.current,
      progress_total: item.progress.total,
      logs: item.logs
    }])
    .select()
    .single();

  if (error) {
    console.error("Error saving to post_queue:", error);
    throw error;
  }
  return data;
};

export const fetchPostQueue = async () => {
  const { data, error } = await supabase
    .from('post_queue')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Error fetching post_queue:", error);
    return [];
  }
  return data || [];
};

export const updatePostQueueStatus = async (id: string, updates: any) => {
  const { error } = await supabase
    .from('post_queue')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error("Error updating post_queue:", error);
  }
};

export const deletePostQueueItem = async (id: string) => {
  const { error } = await supabase.from('post_queue').delete().eq('id', id);
  if (error) console.error("Error deleting post_queue:", error);
};

export const clearCompletedPostQueue = async () => {
  const { error } = await supabase.from('post_queue').delete().in('status', ['done', 'error']);
  if (error) console.error("Error clearing post_queue:", error);
};
