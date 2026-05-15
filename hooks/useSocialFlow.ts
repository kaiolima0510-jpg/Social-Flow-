
import { useState, useEffect, useCallback, useRef } from 'react';
import { Tab, FacebookAccount, FacebookPage, PostType, PageGroup, QueueItem } from '../types';
import { 
  cleanToken, 
  postToFacebook, 
  postComment, 
  fetchPageMetrics, 
  validateTokenAndFetchPages, 
  createUniqueImageHash, 
  createUniqueBinaryHash 
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
  scheduleComment
} from '../services/supabaseService';
import { generateBatchVariations, formatTextWithAI, generateAlbumDescriptions } from '../services/geminiService';
import { fetchGoogleSheetData, SpreadsheetRow } from '../services/spreadsheetService';

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
  const [useAI, setUseAI] = useState(true);
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

  // ===== POST QUEUE =====
  const [postQueue, setPostQueue] = useState<QueueItem[]>([]);
  const queueRunningRef = useRef(false);
  const postQueueRef = useRef<QueueItem[]>([]);
  // keep ref in sync
  useEffect(() => { postQueueRef.current = postQueue; }, [postQueue]);


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
            media: prev.type === 'ALBUM' ? [...prev.media, newMedia] : [newMedia] 
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

  const syncTokens = async () => {
    if (!tokenInput) return;
    setIsProcessing(true);
    try {
      const tokens = tokenInput.split('\n').map(t => cleanToken(t)).filter(t => t.length > 10);
      for (const token of tokens) {
        const validation = await validateTokenAndFetchPages(token);
        if (validation.isValid) {
          await saveFullAccount({ name: validation.userName, token, pages: validation.pages as FacebookPage[] });
          addSecurityLog(`GATEWAY: ${validation.userName} sincronizado (${validation.pages.length} páginas).`);
        } else {
          addSecurityLog(`FAIL: Token inválido ou erro de conexão.`);
        }
      }
      await loadAccounts();
      setTokenInput("");
      setIsImportModalOpen(false);
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
    
    setManualData(prev => ({ 
      ...prev, 
      media: prev.type === 'ALBUM' ? [...prev.media, ...newMedia] : newMedia 
    }));
  };

  const handleRunBulk = async () => {
    const matchedRows = sheetRows.filter(r => bulkFiles.has(r.fileName));
    if (matchedRows.length === 0) return alert("Nenhum arquivo local coincide com a planilha.");
    const activePages = accounts.flatMap(acc => (acc.pages || []).map(p => ({ ...p, parentToken: acc.token })))
      .filter(p => selectedPageIds.has(p.fb_id));
    if (activePages.length === 0) return alert("Selecione ao menos uma página.");

    setIsProcessing(true);
    setProgress({ current: 0, total: matchedRows.length * activePages.length });

    try {
      for (const row of matchedRows) {
        const fileData = bulkFiles.get(row.fileName)!;
        const historyId = await logPostHistory({ 
          main_caption: row.caption, 
          first_comment: row.comment, 
          target_group: 'Bulk', 
          post_type: bulkType 
        });

        let variations: string[] = [];
        let commentVariations: string[] = [];
        
        if (useAI && bulkType !== 'STORY') {
          try {
            addSecurityLog("IA: Gerando variações de legenda...");
            const aiRes = await generateBatchVariations(row.caption, activePages.length);
            variations = aiRes.variations;
            
            if (row.comment) {
              addSecurityLog("IA: Gerando variações de comentário...");
              const cmtAiRes = await generateBatchVariations(row.comment, activePages.length);
              commentVariations = cmtAiRes.variations;
            }
          } catch (e) {}
        }


        for (let i = 0; i < activePages.length; i++) {
          const page = activePages[i];
          setProgress(p => ({ ...p, current: p.current + 1 }));
          
          const finalCaption = (useAI && variations[i]) ? variations[i] : row.caption;
          const finalComment = (useAI && commentVariations[i]) ? commentVariations[i] : row.comment;

          const uniqueBlob = fileData.file.type.startsWith('video') 
            ? await createUniqueBinaryHash(fileData.file) 
            : await createUniqueImageHash(fileData.file, bulkType === 'STORY');
          
          const schedDate = row.scheduledDate ? new Date(row.scheduledDate) : null;
          const sched = schedDate ? Math.floor(schedDate.getTime() / 1000) : undefined;
          
          const res = await postToFacebook(
            page.access_token || page.parentToken, 
            page.fb_id, 
            finalCaption, 
            [{ blob: uniqueBlob, description: "" }], 
            sched, 
            bulkType,
            bulkType === 'STORY' ? row.comment : undefined
          );

          await logPublication(historyId, page.fb_id, res.success ? 'success' : 'error', res.error || 'OK', res.id, useAI ? 100 : 0);
          
          if (res.success && row.comment && bulkType !== 'STORY') {
            if (sched) {
              await scheduleComment({
                page_id: page.fb_id,
                access_token: page.access_token || page.parentToken,
                fb_post_id: res.id!,
                comment_text: row.comment,
                scheduled_time: schedDate!.toISOString()
              });
              addSecurityLog(`CMT: Comentário agendado para ${page.name}.`);
            } else if (manualData.commentDelay > 0) {
              const futureTime = new Date(Date.now() + manualData.commentDelay * 60000);
              await scheduleComment({
                page_id: page.fb_id,
                access_token: page.access_token || page.parentToken,
                fb_post_id: res.id!,
                comment_text: row.comment,
                scheduled_time: futureTime.toISOString()
              });
              addSecurityLog(`CMT: Robot agendado (${manualData.commentDelay}min) em ${page.name}.`);
            } else {
              const propagationDelay = 2000 + Math.random() * 2000;
              await new Promise(r => setTimeout(r, propagationDelay));

              const cmtRes = await postComment(page.access_token || page.parentToken, res.id!, finalComment);

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

  // ===== QUEUE PROCESSOR =====
  const processQueueItem = async (item: QueueItem) => {
    const log = (msg: string) => {
      addSecurityLog(msg);
      setPostQueue(prev => prev.map(i => i.id === item.id ? { ...i, logs: [...i.logs, msg] } : i));
    };
    const setItemProgress = (current: number) => {
      setPostQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: { ...i.progress, current } } : i));
    };

    log(`ENGINE: Iniciando [${item.label}] em ${item.pages.length} páginas...`);

    let variations: string[] = [];
    let commentVariations: string[] = [];

    if (item.useAI && item.type !== 'STORY') {
      try {
        log("IA: Gerando variações...");
        const aiRes = await generateBatchVariations(item.caption, item.pages.length);
        variations = aiRes.variations;
        const firstCmt = item.comments?.[0]?.text;
        if (firstCmt) {
          const cmtAiRes = await generateBatchVariations(firstCmt, item.pages.length);
          commentVariations = cmtAiRes.variations;
        }
      } catch (e) { /* continua sem variações */ }
    }

    try {
      const historyId = await logPostHistory({
        main_caption: item.caption,
        first_comment: item.comments?.[0]?.text || "",
        target_group: item.label,
        post_type: item.type
      });

      for (let i = 0; i < item.pages.length; i++) {
        const page = item.pages[i];
        setItemProgress(i + 1);

        const finalCaption = (item.useAI && variations[i]) ? variations[i] : item.caption;
        const schedDate = new Date(item.scheduledDate);
        const sched = item.isScheduled ? Math.floor(schedDate.getTime() / 1000) : undefined;

        const uniqueMedia = await Promise.all(item.media.map(async (m) => ({
          blob: m.type === 'IMAGE'
            ? await createUniqueImageHash(m.file, item.type === 'STORY')
            : await createUniqueBinaryHash(m.file),
          description: m.description
        })));

        const res = await postToFacebook(
          page.access_token || page.parentToken,
          page.fb_id,
          finalCaption,
          uniqueMedia,
          sched,
          item.type,
          item.type === 'STORY' ? item.storyLink : undefined
        );

        await logPublication(historyId, page.fb_id, res.success ? 'success' : 'error', res.error || 'OK', res.id, item.useAI ? 100 : 0);

        if (res.success) {
          log(`OK: ${page.name} publicado.`);
          
          if (item.autoReplyText && item.autoReplyText.trim()) {
            await saveAutoReplyConfig(page.fb_id, res.id!, item.autoReplyText.trim(), page.access_token || page.parentToken);
            log(`MSG: Auto-Reply configurado para ${page.name}.`);
          }

          if (item.comments && item.comments.length > 0 && item.type !== 'STORY') {
            for (let c = 0; c < item.comments.length; c++) {
              const cmt = item.comments[c];
              const cmtText = (c === 0 && item.useAI && commentVariations[i]) ? commentVariations[i] : cmt.text;
              if (!cmtText.trim()) continue;

              if (sched) {
                await scheduleComment({ page_id: page.fb_id, access_token: page.access_token || page.parentToken, fb_post_id: res.id!, comment_text: cmtText, scheduled_time: schedDate.toISOString() });
                log(`CMT: Agendado para ${page.name}.`);
              } else if (cmt.delay > 0) {
                const futureTime = new Date(Date.now() + cmt.delay * 60000);
                await scheduleComment({ page_id: page.fb_id, access_token: page.access_token || page.parentToken, fb_post_id: res.id!, comment_text: cmtText, scheduled_time: futureTime.toISOString() });
                log(`CMT: Robot agendado para daqui a ${cmt.delay}min em ${page.name}.`);
              } else {
                const propagationDelay = 2000 + Math.random() * 2000;
                await new Promise(r => setTimeout(r, propagationDelay));
                const cmtRes = await postComment(page.access_token || page.parentToken, res.id!, cmtText);
                if (cmtRes.id) log(`CMT: Comentário em ${page.name}.`);
                else log(`FAIL CMT: ${page.name}: ${(cmtRes.error?.message || '').substring(0, 30)}`);
              }
            }
          }
        } else {
          log(`FAIL: ${page.name} - ${(res.error || '').substring(0, 40)}`);
        }
        await new Promise(r => setTimeout(r, 8000 + Math.random() * 7000));
      }

      setPostQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i));
      log(`✓ [${item.label}] concluído.`);
      loadAccounts();
    } catch (e: any) {
      setPostQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
      log(`ERR: ${e.message}`);
    }
  };

  const runQueue = async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    while (true) {
      const pending = postQueueRef.current.find(i => i.status === 'pending');
      if (!pending) break;
      setPostQueue(prev => prev.map(i => i.id === pending.id ? { ...i, status: 'processing' } : i));
      // Update ref immediately so next iteration doesn't re-pick this item
      postQueueRef.current = postQueueRef.current.map(i => i.id === pending.id ? { ...i, status: 'processing' } : i);
      await processQueueItem(pending);
    }
    queueRunningRef.current = false;
  };

  // ===== ADD TO QUEUE (replaces handleAction) =====
  const addToQueue = (isScheduled: boolean) => {
    if (manualData.media.length === 0) return alert('Escolha uma imagem ou vídeo.');
    const activePages = accounts
      .flatMap(acc => (acc.pages || []).map(p => ({ ...p, parentToken: acc.token })))
      .filter(p => selectedPageIds.has(p.fb_id));
    if (activePages.length === 0) return alert('Selecione ao menos um conjunto/página.');

    const selectedGroup = pageGroups.find(g =>
      g.page_ids.length === selectedPageIds.size && g.page_ids.every(id => selectedPageIds.has(id))
    );
    const label = `${selectedGroup?.name || 'Manual'} – ${manualData.type}`;

    const newItem: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
      media: manualData.media.map(m => ({ ...m })), // snapshot
      progress: { current: 0, total: activePages.length },
      logs: [],
      createdAt: new Date().toLocaleTimeString('pt-BR'),
    };

    setPostQueue(prev => [...prev, newItem]);
    postQueueRef.current = [...postQueueRef.current, newItem];

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

    addSecurityLog(`QUEUE: [${label}] adicionado à fila (${activePages.length} páginas).`);

    // Kick off queue processor in background (non-blocking)
    setTimeout(() => runQueue(), 100);
  };

  const removeFromQueue = (id: string) => {
    setPostQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearCompletedFromQueue = () => {
    setPostQueue(prev => prev.filter(i => i.status === 'pending' || i.status === 'processing'));
  };


    
  const deleteAccount = async (id: string) => {
    await deleteAccountFromCloud(id);
    await loadAccounts();
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
    manualData, setManualData, handleMagicFormat, handleGenerateAlbumDescriptions, handleMediaUpload,
    handleAction: addToQueue,
    postQueue, removeFromQueue, clearCompletedFromQueue,
    togglePageSelection, handleSelectGroup, handleCreateGroup, deletePageGroup: deletePageGroupById,
    reSyncAccount,
    addSecurityLog
  };
};
