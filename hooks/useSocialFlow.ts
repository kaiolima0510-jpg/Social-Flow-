
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tab, FacebookAccount, FacebookPage, PostType, PageGroup, QueueItem } from '../types';
import { 
  cleanToken, 
  postToFacebook, 
  postComment, 
  fetchPageMetrics, 
  validateTokenAndFetchPages, 
  createUniqueImageHash, 
  createUniqueBinaryHash,
  subscribePageToWebhook
} from '../services/facebookService';
import { 
  fetchAccountsFromCloud, 
  deleteAccountFromCloud, 
  saveFullAccount, 
  logPostHistory, 
  logPageMetrics, 
  fetchAllPagesStatsSummary, 
  logPublication, 
  fetchPageGroups, 
  savePageGroup, 
  deletePageGroup, 
  fetchScheduledCommentsSummary, 
  updateScheduledCommentStatus,
  saveAutoReplyConfig,
  scheduleComment,
  savePostQueue,
  fetchPostQueue,
  uploadMediaToStorage,
  deletePostQueueItem,
  clearCompletedPostQueue
} from '../services/supabaseService';
import { generateBatchVariations, formatTextWithAI, generateAlbumDescriptions } from '../services/geminiService';
import { fetchGoogleSheetData, SpreadsheetRow } from '../services/spreadsheetService';

export const parseSpintax = (text: string): string => {
  if (!text) return text;
  let parsed = text;
  while (/{[^{}]+}/.test(parsed)) {
    parsed = parsed.replace(/{([^{}]+)}/g, (match, contents) => {
      const choices = contents.split('|');
      return choices[Math.floor(Math.random() * choices.length)];
    });
  }
  return parsed;
};

const executeWithBackoff = async (fn: () => Promise<any>, logFn: (msg: string) => void) => {
  let attempts = 0;
  while (attempts < 3) {
    const res = await fn();
    const errorCode = res?.code || res?.error?.code;
    if (errorCode === 613 || errorCode === 368 || errorCode === 4 || errorCode === 17) {
      attempts++;
      logFn(`RATE LIMIT: Bloqueio (Erro ${errorCode}). Pausa de 60-120s (Tentativa ${attempts}/3)...`);
      await new Promise(r => setTimeout(r, (60 * 1000) + Math.random() * (60 * 1000)));
      if (attempts >= 3) return res;
    } else {
      return res;
    }
  }
};

export const useSocialFlow = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sf_dark_mode');
    const dark = saved ? saved === 'true' : false;
    if (dark) document.documentElement.classList.add('dark');
    return dark;
  });

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('sf_dark_mode', String(next));
      return next;
    });
  };
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [tokenInput, setTokenInput] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [realPageMetrics, setRealPageMetrics] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<string[]>(["SocialFlow Core Online", "Pronto para operar."]);
  const [robotLogs, setRobotLogs] = useState<any[]>([]);
  const [stealthStats, setStealthStats] = useState({ totalTokens: 0, integrity: 99.9 });
  
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [pageSearch, setPageSearch] = useState("");

  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetRows, setSheetRows] = useState<SpreadsheetRow[]>([]);
  const [bulkFiles, setBulkFiles] = useState<Map<string, { file: File, preview: string }>>(new Map());
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [bulkType, setBulkType] = useState<PostType>('SINGLE');
  const [enableRotation, setEnableRotation] = useState(false);

  // ===== POST QUEUE (Remote) =====
  const [postQueue, setPostQueue] = useState<any[]>([]);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const remoteQueue = await fetchPostQueue();
        const mappedQueue = remoteQueue.map((q: any) => ({
          id: q.id,
          status: q.status,
          label: q.label,
          type: q.type,
          caption: q.caption,
          comments: q.comments,
          autoReplyText: q.auto_reply_text,
          storyLink: q.story_link,
          isScheduled: q.is_scheduled,
          scheduledDate: q.scheduled_date,
          useAI: q.use_ai,
          pages: q.pages,
          mediaUrls: q.media_urls,
          progress: { current: q.progress_current || 0, total: q.progress_total || 0 },
          logs: q.logs || [],
          createdAt: new Date(q.created_at).toLocaleTimeString('pt-BR')
        }));
        setPostQueue(mappedQueue);
      } catch (e) {}
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);


  const [manualData, setManualData] = useState({
    caption: "", 
    comments: [{ text: "", delay: 0 }], 
    autoReplyText: "",
    scheduledDate: "",
    storyLink: "", 
    type: 'SINGLE' as PostType,
    media: [] as { id: string, file: File, preview: string, type: 'IMAGE' | 'VIDEO', description: string }[]
  });


  const addSecurityLog = (msg: string) => {
    setSecurityLogs(prev => [msg, ...prev].slice(0, 25));
  };

  const loadAccounts = useCallback(async () => {
    setIsProcessing(true);
    addSecurityLog("SCAN: Verificando integridade da rede...");
    try {
      // Execute each promise individually to avoid one failure blocking everything
      let cloudAccounts: any[] = [];
      let groups: any[] = [];
      let robotData: any[] = [];

      try {
        cloudAccounts = await fetchAccountsFromCloud();
        addSecurityLog(`GATEWAY: ${cloudAccounts.length} contas carregadas da nuvem.`);
      } catch (e: any) {
        addSecurityLog(`FAIL: Erro ao carregar contas: ${e.message}`);
      }

      try {
        groups = await fetchPageGroups();
        setPageGroups(groups);
      } catch (e: any) {
        addSecurityLog(`FAIL: Erro ao carregar combos: ${e.message}`);
      }

      try {
        robotData = await fetchScheduledCommentsSummary();
        setRobotLogs(robotData);
      } catch (e: any) {
        addSecurityLog(`FAIL: Erro ao carregar logs do robô: ${e.message}`);
      }
      
      const allPages = cloudAccounts.flatMap(acc => 
        (acc.pages || []).map(page => ({ ...page, parentToken: acc.token }))
      );

      if (allPages.length === 0) {
        setAccounts(cloudAccounts);
        setIsProcessing(false);
        return;
      }

      const targetPageIds = allPages.map(p => p.fb_id);
      let allStats: any = {};
      try {
        allStats = await fetchAllPagesStatsSummary(targetPageIds);
      } catch (e) {}

      addSecurityLog("CORE: Calculando métricas de performance...");
      const metricsPromises = allPages.map(async (page) => {
        try {
          const m = await fetchPageMetrics(page.fb_id, page.access_token || page.parentToken);
          const stats = allStats[page.fb_id] || { successRate: 100, tokens: 0, lastPost: null };

          // Fallback if we can't get metrics but the page exists in our DB
          return {
            metric: { 
              name: page.name, 
              fans: m?.fan_count || 0, 
              fb_id: page.fb_id,
              picture: m?.picture || page.picture,
              reach: m?.reach || 0,
              engagement: (m?.fan_count > 0) ? parseFloat(((m.engaged / m.fan_count) * 100).toFixed(2)) : 0,
              safety_score: stats.successRate, 
              status: 'active',
              health: (m && !m.error) ? 'healthy' : 'warning',
              errorDetails: m?.errorDetails,
              tokens: stats.tokens,
              lastPost: stats.lastPost
            },
            tokens: stats.tokens
          };
        } catch (e) {
          console.error(`Erro ao carregar métricas da página ${page.name}:`, e);
        }
        return null;
      });

      const results = await Promise.all(metricsPromises);
      const pageMetricsArr: any[] = [];
      let totalTokensAccumulated = 0;
      const allPageIds: string[] = [];

      results.forEach(res => {
        if (res) {
          pageMetricsArr.push(res.metric);
          totalTokensAccumulated += res.tokens;
          allPageIds.push(res.metric.fb_id);
        }
      });

      setAccounts(cloudAccounts);
      setRealPageMetrics(pageMetricsArr);
      if (selectedPageIds.size === 0) {
        setSelectedPageIds(new Set(allPageIds));
      }
      setStealthStats(prev => ({ ...prev, totalTokens: totalTokensAccumulated }));
      addSecurityLog(`STATUS: ${pageMetricsArr.length} canais ativos e sincronizados.`);
    } catch (err: any) {
      addSecurityLog(`CRITICAL: Erro na orquestração: ${err.message}`);
    } finally { 
      setIsProcessing(false); 
    }
  }, [selectedPageIds.size]);

  useEffect(() => { loadAccounts(); }, []);

  const handleMagicFormat = async () => {
    if (!manualData.caption) return;
    setIsProcessing(true);
    try {
      const formatted = await formatTextWithAI(manualData.caption);
      setManualData(prev => ({ ...prev, caption: formatted }));
      addSecurityLog("IA: Texto formatado com sucesso.");
    } finally { setIsProcessing(false); }
  };

  const handleGenerateAlbumDescriptions = async () => {
    if (!manualData.caption || manualData.media.length === 0) return;
    setIsProcessing(true);
    try {
      const descriptions = await generateAlbumDescriptions(manualData.caption, manualData.media.length);
      setManualData(prev => ({
        ...prev,
        media: prev.media.map((m, i) => ({ ...m, description: descriptions[i] || m.description }))
      }));
      addSecurityLog("IA: Descrições do álbum geradas.");
    } finally { setIsProcessing(false); }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (activeTab !== Tab.EDITOR_STEALTH) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const newMedia = {
            id: Math.random().toString(36).substring(2, 9),
            file,
            preview: URL.createObjectURL(file),
            type: 'IMAGE' as const,
            description: ""
          };
          setManualData(prev => ({ 
            ...prev, 
            media: prev.type === 'ALBUM' ? [...prev.media, newMedia] : [newMedia],
            type: prev.type === 'VIDEO' ? 'SINGLE' : prev.type
          }));
          addSecurityLog("MEDIA: Imagem colada da área de transferência.");
        }
      }
    }
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleCreateGroup = async () => {
    if (!newGroupName || selectedPageIds.size === 0) return;
    setIsProcessing(true);
    try {
      const group = await savePageGroup(newGroupName, Array.from(selectedPageIds));
      if (group) {
        setPageGroups(prev => [...prev.filter(g => g && g.name !== newGroupName), group]);
        setNewGroupName("");
        setIsGroupModalOpen(false);
        addSecurityLog(`GROUP: Conjunto '${newGroupName}' criado.`);
      }
    } finally { setIsProcessing(false); }
  };

  const handleSelectGroup = (group: PageGroup) => {
    setSelectedPageIds(new Set(group.page_ids));
    addSecurityLog(`GROUP: Conjunto '${group.name}' selecionado.`);
  };

  const togglePageSelection = (fbId: string) => {
    const newSet = new Set(selectedPageIds);
    if (newSet.has(fbId)) newSet.delete(fbId);
    else newSet.add(fbId);
    setSelectedPageIds(newSet);
  };

  const syncTokens = async (): Promise<{ successes: string[], errors: string[], totalImported: number }> => {
    if (!tokenInput) return { successes: [], errors: [], totalImported: 0 };
    setIsProcessing(true);
    let totalImported = 0;
    const errors: string[] = [];
    const successes: string[] = [];

    try {
      const tokens = tokenInput.split('\n').map(t => cleanToken(t)).filter(t => t.length > 10);
      for (const token of tokens) {
        try {
          const validation = await validateTokenAndFetchPages(token);
          if (validation.isValid) {
            if (validation.pages.length === 0) {
              errors.push(`O token de "${validation.userName}" não retornou nenhuma página. Verifique se o token possui permissões ativas de administrador de páginas.`);
              addSecurityLog(`FAIL: O token de "${validation.userName}" retornou 0 páginas.`);
              continue;
            }

            await saveFullAccount({ name: validation.userName, token, pages: validation.pages as FacebookPage[] });
            totalImported += validation.pages.length;
            successes.push(`✅ "${validation.userName}" — ${validation.pages.length} página(s) conectada(s).`);
            
            // Subscribe pages in background (Parallel) to avoid UI blocking
            const subscribeAll = async () => {
              addSecurityLog(`WEBHOOK: Iniciando assinatura de ${validation.pages.length} páginas...`);
              const promises = validation.pages.map(p => 
                subscribePageToWebhook(p.fb_id, p.access_token).catch(() => null)
              );
              await Promise.all(promises);
              addSecurityLog(`WEBHOOK: Todas as páginas de ${validation.userName} foram processadas.`);
            };
            
            subscribeAll();

            addSecurityLog(`GATEWAY: ${validation.userName} sincronizado (${validation.pages.length} páginas).`);
          } else {
            errors.push(`❌ Token inválido: ${validation.error || 'Erro desconhecido'}`);
            addSecurityLog(`FAIL: ${validation.error || 'Token inválido'}`);
          }
        } catch (err: any) {
          errors.push(`❌ Falha ao processar token: ${err.message}`);
          addSecurityLog(`ERRO FATAL: ${err.message}`);
          console.error("Import Error:", err);
        }
      }
      await loadAccounts();
      setTokenInput("");
      // Modal stays open to show the result — ImportModal will auto-close after displaying feedback
      return { successes, errors, totalImported };
    } finally { setIsProcessing(false); }
  };

  const handleSyncSheet = async () => {
    if (!sheetUrl) return alert("Insira o link da planilha.");
    setIsSyncingSheet(true);
    try {
      const rows = await fetchGoogleSheetData(sheetUrl);
      setSheetRows(rows);
      addSecurityLog(`SYNC: ${rows.length} linhas importadas.`);
    } catch (e: any) { alert(e.message); } finally { setIsSyncingSheet(false); }
  };

  const handleBulkFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = new Map(bulkFiles);
    const files: File[] = Array.from(e.target.files);
    files.forEach((file: File) => {
      const name = file.name.split('.').slice(0, -1).join('.');
      newFiles.set(name, { file, preview: URL.createObjectURL(file) });
    });
    setBulkFiles(newFiles);
    addSecurityLog(`MEDIA BULK: ${files.length} arquivos carregados.`);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArr = Array.from(e.target.files);
    const newMedia = filesArr.map((file: File) => {
      const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        preview: URL.createObjectURL(file),
        type: isVideo ? 'VIDEO' as const : 'IMAGE' as const,
        description: ""
      };
    });
    
    setManualData(prev => {
      const updatedMedia = prev.type === 'ALBUM' ? [...prev.media, ...newMedia] : newMedia;
      let updatedType = prev.type;
      
      if (newMedia.length > 0) {
        const firstIsVideo = newMedia[0].type === 'VIDEO';
        if (firstIsVideo && prev.type !== 'STORY') {
          updatedType = 'VIDEO';
        } else if (!firstIsVideo && prev.type === 'VIDEO') {
          updatedType = 'SINGLE';
        }
      }
      
      return { 
        ...prev, 
        media: updatedMedia,
        type: updatedType
      };
    });
  };

  const handleRunBulk = async () => {
    const matchedRows = sheetRows.filter(r => bulkFiles.has(r.fileName));
    if (matchedRows.length === 0) return alert("Nenhum arquivo local coincide com a planilha.");
    const activePages = accounts.flatMap(acc => (acc.pages || []).map(p => ({ ...p, parentToken: acc.token })))
      .filter(p => selectedPageIds.has(p.fb_id))
      .sort(() => Math.random() - 0.5);
    if (activePages.length === 0) return alert("Selecione ao menos uma página.");

    setIsProcessing(true);
    setProgress({ current: 0, total: matchedRows.length * activePages.length });

    try {
      let allVariations: string[][] = [];
      let allCommentVariations: string[][] = [];
      
      if (useAI && bulkType !== 'STORY') {
        for (let r = 0; r < matchedRows.length; r++) {
           addSecurityLog(`IA: Gerando variações para linha ${r+1}...`);
           try {
             const aiRes = await generateBatchVariations(matchedRows[r].caption, activePages.length);
             allVariations[r] = aiRes.variations || [];
             if (matchedRows[r].comment) {
                const cmtAiRes = await generateBatchVariations(matchedRows[r].comment, activePages.length);
                allCommentVariations[r] = cmtAiRes.variations || [];
             } else {
                allCommentVariations[r] = [];
             }
           } catch (e) {
             allVariations[r] = [];
             allCommentVariations[r] = [];
           }
        }
      }

      for (let r = 0; r < matchedRows.length; r++) {
        const timeRow = matchedRows[r];
        const schedDate = timeRow.scheduledDate ? new Date(timeRow.scheduledDate) : null;
        const sched = schedDate ? Math.floor(schedDate.getTime() / 1000) : undefined;
        
        const historyId = await logPostHistory({ 
          main_caption: timeRow.caption, 
          first_comment: timeRow.comment, 
          target_group: enableRotation ? 'Bulk (Matrix)' : 'Bulk', 
          post_type: bulkType 
        });

        for (let i = 0; i < activePages.length; i++) {
          if (i > 0 && i % 20 === 0) {
            addSecurityLog("PAUSA: Macro-Delay ativado. Descansando por 3 a 5 minutos...");
            await new Promise(res => setTimeout(res, (3 * 60 * 1000) + Math.random() * (2 * 60 * 1000)));
          }

          const page = activePages[i];
          setProgress(p => ({ ...p, current: p.current + 1 }));
          
          const blockIndex = Math.floor(i / 10);
          const contentRowIndex = enableRotation ? (r + blockIndex) % matchedRows.length : r;
          const contentRow = matchedRows[contentRowIndex];
          const fileData = bulkFiles.get(contentRow.fileName)!;
          
          let finalCaption = (useAI && allVariations[contentRowIndex]?.[i]) ? allVariations[contentRowIndex][i] : contentRow.caption;
          let finalComment = (useAI && allCommentVariations[contentRowIndex]?.[i]) ? allCommentVariations[contentRowIndex][i] : contentRow.comment;

          finalCaption = parseSpintax(finalCaption);
          if (finalComment) finalComment = parseSpintax(finalComment);

          const uniqueBlob = fileData.file.type.startsWith('video') 
            ? await createUniqueBinaryHash(fileData.file) 
            : await createUniqueImageHash(fileData.file, bulkType === 'STORY');
          
          const res = await executeWithBackoff(() => postToFacebook(
            page.access_token || page.parentToken, 
            page.fb_id, 
            finalCaption, 
            [{ blob: uniqueBlob, description: "" }], 
            sched, 
            bulkType,
            bulkType === 'STORY' ? contentRow.comment : undefined
          ), addSecurityLog);

          await logPublication(historyId, page.fb_id, res.success ? 'success' : 'error', res.error || 'OK', res.id, useAI ? 100 : 0);
          
          if (res.success && contentRow.comment && bulkType !== 'STORY') {
            if (sched) {
              await scheduleComment({
                page_id: page.fb_id,
                access_token: page.access_token || page.parentToken,
                fb_post_id: res.id!,
                comment_text: contentRow.comment,
                scheduled_time: schedDate!.toISOString()
              });
              addSecurityLog(`CMT: Comentário agendado para ${page.name}.`);
            } else if ((manualData.comments?.[0]?.delay || 0) > 0) {
              const delayMin = manualData.comments[0].delay;
              const futureTime = new Date(Date.now() + delayMin * 60000);
              await scheduleComment({
                page_id: page.fb_id,
                access_token: page.access_token || page.parentToken,
                fb_post_id: res.id!,
                comment_text: contentRow.comment,
                scheduled_time: futureTime.toISOString()
              });
              addSecurityLog(`CMT: Robot agendado (${delayMin}min) em ${page.name}.`);
            } else {
              const propagationDelay = 2000 + Math.random() * 2000;
              await new Promise(r => setTimeout(r, propagationDelay));

              const cmtRes = await executeWithBackoff(() => postComment(page.access_token || page.parentToken, res.id!, finalComment), addSecurityLog);

              if (cmtRes.id) {
                addSecurityLog(`CMT: Comentário postado em ${page.name}.`);
              } else {
                const errMsg = cmtRes.error?.message || "Erro desconhecido";
                addSecurityLog(`FAIL: Comentário em ${page.name}: ${errMsg.substring(0, 25)}...`);
              }
            }

          }

          await new Promise(r => setTimeout(r, 8000 + Math.random() * 7000)); // Delay entre páginas (8-15s)

        }
      }
      alert("Lote concluído.");
      loadAccounts();
    } finally { setIsProcessing(false); }
  };

  // ===== ADD TO QUEUE (Server-Side) =====
  const addToQueue = async (isScheduled: boolean) => {
    if (manualData.media.length === 0) return alert('Escolha uma imagem ou vídeo.');
    const activePages = accounts
      .flatMap(acc => (acc.pages || []).map(p => ({ ...p, parentToken: acc.token })))
      .filter(p => selectedPageIds.has(p.fb_id))
      .sort(() => Math.random() - 0.5);
    if (activePages.length === 0) return alert('Selecione ao menos um conjunto/página.');

    const selectedGroup = pageGroups.find(g =>
      g.page_ids.length === selectedPageIds.size && g.page_ids.every(id => selectedPageIds.has(id))
    );
    const label = `${selectedGroup?.name || 'Manual'} – ${manualData.type}`;

    setIsProcessing(true);
    try {
      addSecurityLog(`UPLOADING: Fazendo upload de ${manualData.media.length} arquivos...`);
      const mediaUrls = [];
      for (const m of manualData.media) {
        const url = await uploadMediaToStorage(m.file);
        if (url) mediaUrls.push(url);
      }
      
      if (mediaUrls.length !== manualData.media.length) {
         addSecurityLog(`FAIL: Falha no upload de mídia. Tente novamente.`);
         return;
      }

      const dbItem = {
         status: 'pending',
         label,
         type: manualData.type,
         caption: manualData.caption,
         comments: manualData.comments,
         autoReplyText: manualData.autoReplyText,
         storyLink: manualData.storyLink,
         isScheduled,
         scheduledDate: manualData.scheduledDate,
         useAI,
         pages: activePages,
         mediaUrls,
         progress: { current: 0, total: activePages.length },
         logs: [`QUEUE: [${label}] adicionado à fila (${activePages.length} páginas).`]
      };

      await savePostQueue(dbItem);

      // Clear the form immediately so user can start next post
      setManualData({
        caption: '',
        comments: [{ text: "", delay: 0 }],
        autoReplyText: '',
        scheduledDate: '',
        storyLink: '',
        type: manualData.type, // keep type
        media: []
      });

      addSecurityLog(`QUEUE: [${label}] adicionado à fila remota com sucesso.`);
    } catch (e: any) {
      addSecurityLog(`FAIL: Erro ao enfileirar: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFromQueue = async (id: string) => {
    await deletePostQueueItem(id);
    setPostQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearCompletedFromQueue = async () => {
    await clearCompletedPostQueue();
    setPostQueue(prev => prev.filter(i => i.status === 'pending' || i.status === 'processing'));
  };


    
  const deleteAccount = async (id: string) => {
    setIsProcessing(true);
    addSecurityLog("Removendo perfil da base de dados...");
    try {
      await deleteAccountFromCloud(id);
      addSecurityLog("Perfil removido com sucesso.");
    } catch (e: any) {
      addSecurityLog(`Erro ao remover: ${e.message}`);
    }
    await loadAccounts();
    setIsProcessing(false);
  };

  const deletePageGroupById = async (id: string) => {
    await deletePageGroup(id);
    setPageGroups(prev => prev.filter(g => g.id !== id));
    addSecurityLog("GROUP: Conjunto removido.");
  };

  const reSyncAccount = async (account: FacebookAccount) => {
    setIsProcessing(true);
    addSecurityLog(`SYNC: Sincronizando ${account.name}...`);
    try {
      const validation = await validateTokenAndFetchPages(account.token);
      if (validation.isValid) {
        await saveFullAccount({ name: validation.userName, token: account.token, pages: validation.pages as FacebookPage[] });
        
        // Force Subscribe
        for (const p of validation.pages) {
          try {
            await subscribePageToWebhook(p.fb_id, p.access_token);
          } catch (e) {}
        }

        addSecurityLog(`SYNC: ${validation.userName} atualizado (${validation.pages.length} páginas).`);
        await loadAccounts();
      } else {
        addSecurityLog(`FAIL: Erro ao sincronizar ${account.name}: ${validation.error}`);
      }
    } catch (e: any) {
      addSecurityLog(`FAIL: Erro fatal na sincronização: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    activeTab, setActiveTab,
    isDarkMode, toggleDarkMode,
    accounts, loadAccounts, deleteAccount,
    isImportModalOpen, setIsImportModalOpen,
    isProcessing, progress,
    tokenInput, setTokenInput, syncTokens,
    useAI, setUseAI,
    realPageMetrics,
    securityLogs,
    robotLogs,
    stealthStats,
    selectedPageIds, setSelectedPageIds,
    pageGroups, setPageGroups,
    newGroupName, setNewGroupName,
    isGroupModalOpen, setIsGroupModalOpen,
    isScheduleModalOpen, setIsScheduleModalOpen,
    pageSearch, setPageSearch,
    sheetUrl, setSheetUrl,
    sheetRows, setSheetRows,
    bulkFiles, handleBulkFilesUpload,
    isSyncingSheet, handleSyncSheet,
    bulkType, setBulkType, handleRunBulk,
    enableRotation, setEnableRotation,
    manualData, setManualData, handleMagicFormat, handleGenerateAlbumDescriptions, handleMediaUpload,
    handleAction: addToQueue,
    postQueue, removeFromQueue, clearCompletedFromQueue,
    togglePageSelection, handleSelectGroup, handleCreateGroup, deletePageGroup: deletePageGroupById,
    reSyncAccount,
    addSecurityLog
  };
};
