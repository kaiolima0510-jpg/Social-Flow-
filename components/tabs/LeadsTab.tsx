
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, MessageSquare, Send, RefreshCw, 
  User, Calendar, CheckCircle2, Clock, Filter, 
  MoreVertical, ChevronRight, Hash, Image as ImageIcon,
  Zap, Megaphone, Trash2, Plus, X, ArrowUpRight, Shield, ShieldCheck, Terminal,
  Loader2, AlertTriangle, Globe, Check
} from 'lucide-react';
import { Lead, Message, FacebookPage } from '../../types';
import { 
  fetchPageConversations, 
  sendMessageToPSID, 
  fetchLeadProfile,
  fetchRecentPosts,
  fetchPostComments,
  sendPrivateReply
} from '../../services/facebookService';
import { 
  upsertLead, 
  fetchLeadsByPage, 
  saveMessageLog, 
  fetchMessagesByLead,
  fetchAutomationsByPage,
  saveAutomation,
  deleteAutomation,
  isCommentProcessed,
  markCommentAsProcessed,
  fetchTotalLeadsCount,
  fetchFlowsByPage,
  saveFlow,
  deleteFlow,
  uploadMediaToStorage,
  triggerFlowForLead,
  fetchAllFlows,
  supabase
} from '../../services/supabaseService';

interface LeadsTabProps {
  accounts: any[];
  isDarkMode: boolean;
  addSecurityLog: (msg: string) => void;
}

const LeadsTab: React.FC<LeadsTabProps> = ({ accounts, isDarkMode, addSecurityLog }) => {
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Automations & Broadcast
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [newAuto, setNewAuto] = useState({ trigger_keyword: '', reply_message: '' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);

  // Flows State
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [editingFlow, setEditingFlow] = useState<any | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'dashboard'>('chat');
  const [flowExecutions, setFlowExecutions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalExecutions: 0,
    completed: 0,
    failed: 0,
    waiting: 0,
    conversionRate: 0
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const allPages = (accounts || []).flatMap(acc => (acc.pages || []).map((p: any) => ({ ...p, parentToken: acc.token })));

  useEffect(() => {
    loadTotalLeads();
    loadFlows();
    const interval = setInterval(loadTotalLeads, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPage) {
      loadLeads();
      loadAutomations();
      loadFlows();
    }
  }, [selectedPage]);

  const loadTotalLeads = async () => {
    const count = await fetchTotalLeadsCount();
    setTotalLeadsCount(count);
  };

  const loadDashboardMetrics = async () => {
    if (!selectedPage) return;
    try {
      const { data: execs, error } = await supabase
        .from('fb_flow_executions')
        .select(`
          id,
          status,
          current_step_index,
          error_message,
          created_at,
          comment_id,
          lead_psid,
          fb_flows (
            name,
            steps
          )
        `)
        .eq('page_id', selectedPage.fb_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (execs) {
        setFlowExecutions(execs);
        const total = execs.length;
        const completed = execs.filter(e => e.status === 'completed').length;
        const failed = execs.filter(e => e.status === 'failed' && !e.error_message?.includes('Janela de 24h')).length;
        const waiting = execs.filter(e => e.error_message?.includes('Janela de 24h') || e.error_message?.includes('interação')).length;
        
        // Conversão: Execuções que passaram do passo 0 (significa que o lead respondeu e abriu a janela de 24h)
        const converted = execs.filter(e => e.current_step_index > 1 || e.status === 'completed').length;
        const rate = total > 0 ? Math.round((converted / total) * 100) : 0;

        setMetrics({
          totalExecutions: total,
          completed,
          failed,
          waiting,
          conversionRate: rate
        });
      }
    } catch (e) {
      console.error("Error loading dashboard metrics:", e);
    }
  };

  useEffect(() => {
    if (selectedPage && activeSubTab === 'dashboard') {
      loadDashboardMetrics();
    }
  }, [selectedPage, activeSubTab]);

  useEffect(() => {
    if (selectedLead) {
      loadMessages();
    }
  }, [selectedLead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadLeads = async () => {
    if (!selectedPage) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadsByPage(selectedPage.fb_id);
      setLeads(data);
    } catch (e) {}
    setIsLoading(false);
  };

  const loadAutomations = async () => {
    if (!selectedPage) return;
    try {
      const data = await fetchAutomationsByPage(selectedPage.fb_id);
      setAutomations(data);
    } catch (e) {}
  };

  const loadFlows = async () => {
    try {
      const data = await fetchAllFlows();
      setFlows(data);
    } catch (e) {}
  };

  const loadMessages = async () => {
    if (!selectedLead) return;
    try {
      const data = await fetchMessagesByLead(selectedLead.id);
      setMessages(data);
    } catch (e) {}
  };

  const syncLeadsFromFacebook = async () => {
    if (!selectedPage) return;
    setIsSyncing(true);
    addSecurityLog(`CRM: Sincronizando leads de ${selectedPage.name}...`);
    
    try {
      const tokenToUse = selectedPage.access_token || (selectedPage as any).parentToken;
      const conversations = await fetchPageConversations(selectedPage.fb_id, tokenToUse);
      
      for (const conv of conversations) {
        const participant = conv.participants?.data?.find((p: any) => p.id !== selectedPage.fb_id);
        if (participant) {
          const profile = await fetchLeadProfile(participant.id, tokenToUse);
          const lead = await upsertLead({
            page_id: selectedPage.fb_id,
            psid: participant.id,
            name: profile.name || participant.name,
            profile_pic: profile.profile_pic || '',
            last_interaction: conv.updated_time
          });

          if (lead && conv.messages?.data?.length > 0) {
            const lastMsg = conv.messages.data[0];
            await saveMessageLog({
              lead_id: lead.id,
              sender_id: lastMsg.from.id,
              text: lastMsg.message
            });
          }
        }
      }
      
      addSecurityLog(`CRM: Verificando novos comentários para Auto-Reply...`);
      const posts = await fetchRecentPosts(selectedPage.fb_id, tokenToUse);
      for (const post of posts) {
        const comments = await fetchPostComments(post.id, tokenToUse);
        for (const comment of comments) {
          if (!comment.from || comment.from.id === selectedPage.fb_id) continue;
          
          const alreadyDone = await isCommentProcessed(comment.id);
          if (!alreadyDone) {
            // 1. Try to find a matching Flow
            const matchingFlow = flows.find(f => 
              f.is_active && (f.trigger_type === 'all' || (f.trigger_keyword && comment.message.toLowerCase().includes(f.trigger_keyword.toLowerCase())))
            );

            if (matchingFlow) {
              addSecurityLog(`FLOW: Disparando fluxo "${matchingFlow.name}" para ${comment.from.name}...`);
              await triggerFlowForLead(selectedPage.fb_id, comment.from.id, matchingFlow.id, comment.id);
              await markCommentAsProcessed(comment.id, selectedPage.fb_id);
              
              await upsertLead({
                page_id: selectedPage.fb_id,
                psid: comment.from.id,
                name: comment.from.name,
                last_interaction: new Date().toISOString()
              });
              continue;
            }

            // 2. Fallback to traditional Auto-Reply
            const matchingAuto = automations.find(a => 
              a.is_active && (!a.trigger_keyword || comment.message.toLowerCase().includes(a.trigger_keyword.toLowerCase()))
            );

            if (matchingAuto) {
              addSecurityLog(`AUTO: Respondendo comentário de ${comment.from.name}...`);
              await sendPrivateReply(comment.id, matchingAuto.reply_message, tokenToUse);
              await markCommentAsProcessed(comment.id, selectedPage.fb_id);
              
              await upsertLead({
                page_id: selectedPage.fb_id,
                psid: comment.from.id,
                name: comment.from.name,
                last_interaction: new Date().toISOString()
              });
            }
          }
        }
      }

      await loadLeads();
      await loadTotalLeads();
      addSecurityLog(`CRM: Ciclo de automação concluído.`);
    } catch (e: any) {
      addSecurityLog(`FAIL: Erro na sincronização: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedPage || !selectedLead || !inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    const tempId = Date.now().toString();
    const newMessage: Message = { id: tempId, lead_id: selectedLead.id, sender_id: selectedPage.fb_id, text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, newMessage]);

    try {
      const res = await sendMessageToPSID(selectedPage.fb_id, selectedLead.psid, text, selectedPage.access_token || (selectedPage as any).parentToken);
      if (res.message_id) {
        await saveMessageLog(newMessage);
      } else {
        const errorDetail = res.error?.message ? `: ${res.error.message}` : '';
        addSecurityLog(`FAIL: Erro 24h ou bloqueio no Messenger${errorDetail}`);
      }
    } catch (e: any) { 
      addSecurityLog(`FAIL: Erro ao enviar: ${e.message}`); 
    }
  };

  const handleSaveAutomation = async () => {
    if (!selectedPage || !newAuto.reply_message) return;
    setIsProcessingAction(true);
    try {
      await saveAutomation({ ...newAuto, page_id: selectedPage.fb_id, is_active: true });
      await loadAutomations();
      setNewAuto({ trigger_keyword: '', reply_message: '' });
      addSecurityLog("AUTO: Regra de automação salva.");
    } finally { setIsProcessingAction(false); }
  };

  const handleDeleteAuto = async (id: string) => {
    await deleteAutomation(id);
    await loadAutomations();
    addSecurityLog("AUTO: Regra removida.");
  };

  // Flows Handlers
  const handleCreateNewFlow = () => {
    setEditingFlow({
      name: 'Novo Fluxo',
      trigger_type: 'all',
      trigger_keyword: '',
      steps: [
        { type: 'text', text: 'Olá! Como posso ajudar?' }
      ],
      is_active: true,
      page_ids: selectedPage ? [selectedPage.fb_id] : []
    });
  };

  const handleAddStepToFlow = (type: 'text' | 'image' | 'audio' | 'card' | 'delay') => {
    if (!editingFlow) return;
    const newStep: any = { type };
    if (type === 'text') {
      newStep.text = '';
    } else if (type === 'image' || type === 'audio') {
      newStep.media_url = '';
    } else if (type === 'card') {
      newStep.cards = [
        { title: '', subtitle: '', image_url: '', button_title: '', button_url: '' }
      ];
    } else if (type === 'delay') {
      newStep.delay_value = 10;
      newStep.delay_unit = 'seconds';
    }

    setEditingFlow({
      ...editingFlow,
      steps: [...editingFlow.steps, newStep]
    });
  };

  const handleRemoveStepFromFlow = (index: number) => {
    if (!editingFlow) return;
    setEditingFlow({
      ...editingFlow,
      steps: editingFlow.steps.filter((_: any, i: number) => i !== index)
    });
  };

  const handleUpdateStep = (index: number, fields: any) => {
    if (!editingFlow) return;
    const updatedSteps = [...editingFlow.steps];
    updatedSteps[index] = { ...updatedSteps[index], ...fields };
    setEditingFlow({ ...editingFlow, steps: updatedSteps });
  };

  const handleSaveFlowData = async () => {
    if (!editingFlow || !editingFlow.name.trim()) return;
    setIsProcessingAction(true);
    try {
      const flowToSave = {
        ...editingFlow,
        page_id: editingFlow.page_ids?.[0] || selectedPage?.fb_id || 'global',
        page_ids: editingFlow.page_ids || []
      };
      await saveFlow(flowToSave);
      await loadFlows();
      setEditingFlow(null);
      addSecurityLog("FLOW: Fluxo de mensagens salvo com sucesso!");
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar fluxo: ${e.message}`);
      addSecurityLog(`FAIL: Erro ao salvar fluxo: ${e.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteFlowData = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este fluxo?")) return;
    setIsProcessingAction(true);
    try {
      await deleteFlow(id);
      await loadFlows();
      if (editingFlow?.id === id) setEditingFlow(null);
      addSecurityLog("FLOW: Fluxo excluído.");
    } catch (e: any) {
      addSecurityLog(`FAIL: Erro ao excluir fluxo: ${e.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleStepOrderChange = (index: number, direction: 'up' | 'down') => {
    if (!editingFlow) return;
    const steps = [...editingFlow.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    
    const temp = steps[index];
    steps[index] = steps[targetIndex];
    steps[targetIndex] = temp;
    
    setEditingFlow({ ...editingFlow, steps });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, stepIndex: number, cardIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingFile(true);
    addSecurityLog("FILE: Iniciando upload do arquivo para o Supabase...");
    try {
      const url = await uploadMediaToStorage(file);
      if (url) {
        const updatedSteps = [...editingFlow.steps];
        if (cardIndex !== undefined) {
          updatedSteps[stepIndex].cards[cardIndex].image_url = url;
        } else {
          updatedSteps[stepIndex].media_url = url;
        }
        setEditingFlow({ ...editingFlow, steps: updatedSteps });
        addSecurityLog("FILE: Arquivo enviado com sucesso!");
      } else {
        addSecurityLog("FAIL: Não foi possível subir o arquivo.");
      }
    } catch (err: any) {
      addSecurityLog(`FAIL: Erro de upload: ${err.message}`);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!selectedPage || selectedLeadIds.size === 0 || !broadcastMessage.trim()) return;
    setIsProcessingAction(true);
    addSecurityLog(`BROADCAST: Iniciando disparo para ${selectedLeadIds.size} leads...`);
    
    const leadList = leads.filter(l => selectedLeadIds.has(l.id));
    let success = 0;
    
    for (const lead of leadList) {
      try {
        const res = await sendMessageToPSID(selectedPage.fb_id, lead.psid, broadcastMessage, selectedPage.access_token || (selectedPage as any).parentToken);
        if (res.message_id) success++;
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {}
    }

    addSecurityLog(`BROADCAST: Concluído. ${success}/${leadList.length} mensagens enviadas.`);
    setIsProcessingAction(false);
    setIsBroadcastModalOpen(false);
    setSelectedLeadIds(new Set());
    setBroadcastMessage('');
  };

  const toggleLeadSelection = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const filteredLeads = leads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col h-full animate-fade-up px-6 lg:px-12 pb-20">
      
      {/* TOP HEADER - CRM CONTROL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Shadow CRM</h2>
          <div className="flex items-center gap-3">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 flex items-center gap-2">
                <Shield size={12} /> Stealth Marketing Engine
             </p>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                <Users size={12} /> {totalLeadsCount.toLocaleString()} Total Leads
             </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group min-w-[260px]">
             <div className="absolute -inset-1 bg-indigo-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
             <select 
              value={selectedPage?.fb_id || ''} 
              onChange={(e) => setSelectedPage(allPages.find(p => p.fb_id === e.target.value) || null)}
              className="relative w-full bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
            >
              <option value="">Switch Control Channel...</option>
              {allPages.map(p => <option key={p.fb_id} value={p.fb_id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAutomationModalOpen(true)}
              className="flex items-center gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
            >
              <Zap size={16}/> Auto-Reply
            </button>

            <button 
              onClick={() => setIsFlowModalOpen(true)}
              className="flex items-center gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
            >
              <Users size={16}/> Chatbot Flows
            </button>

            <button 
              onClick={() => setIsBroadcastModalOpen(true)}
              disabled={selectedLeadIds.size === 0}
              className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all disabled:opacity-20 disabled:scale-100 shadow-xl"
            >
              <Megaphone size={16}/> Broadcast ({selectedLeadIds.size})
            </button>

            <button 
              onClick={syncLeadsFromFacebook}
              disabled={!selectedPage || isSyncing}
              className="group bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}/>
            </button>
          </div>
        </div>
      </div>

      {!selectedPage ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white dark:bg-[#0f172a] rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800/50 animate-pulse">
          <div className="w-24 h-24 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-8">
             <Users size={48} strokeWidth={1.5}/>
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase mb-2">Conecte um canal para gerenciar</h3>
          <p className="text-sm font-medium text-slate-400 max-w-xs">Aguardando a seleção de uma página no menu superior para carregar seus leads.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Sub Tab Navigation */}
          <div className="flex gap-4 mb-6 border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
            <button
              onClick={() => setActiveSubTab('chat')}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeSubTab === 'chat'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-650'
              }`}
            >
              💬 Chat CRM & Leads
            </button>
            <button
              onClick={() => setActiveSubTab('dashboard')}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeSubTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-650'
              }`}
            >
              📊 Métricas e Conversão
            </button>
          </div>

          {activeSubTab === 'chat' ? (
            <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0 overflow-hidden">
          
          {/* LEADS LIST SIDEBAR */}
          <div className="w-full lg:w-[400px] flex flex-col bg-white dark:bg-[#0f172a] rounded-[3rem] border border-slate-100 dark:border-slate-800/50 overflow-hidden shadow-sm shadow-indigo-500/5">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800/50">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                   <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                </div>
                <input 
                  type="text" 
                  placeholder="Pesquisar leads..."
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold dark:text-white outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-50 dark:bg-white/5 rounded-2xl skeleton" />
                ))
              ) : filteredLeads.length > 0 ? (
                filteredLeads.map(lead => (
                  <div key={lead.id} className="relative group/lead">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/lead:opacity-100 transition-opacity">
                      <input 
                        type="checkbox" 
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-300
                        ${selectedLead?.id === lead.id 
                          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 translate-x-1' 
                          : 'hover:bg-slate-50 dark:hover:bg-white/5 group-hover/lead:translate-x-1'
                        }
                      `}
                    >
                      <div className="relative shrink-0">
                        <img 
                          src={lead.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=random`} 
                          className={`w-12 h-12 rounded-2xl object-cover border-2 ${selectedLead?.id === lead.id ? 'border-white/30' : 'border-transparent'}`} 
                          alt=""
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#0f172a] rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black truncate leading-tight ${selectedLead?.id === lead.id ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{lead.name}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${selectedLead?.id === lead.id ? 'text-white/60' : 'text-slate-400'}`}>
                           {new Date(lead.last_interaction).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <ChevronRight size={16} className={`shrink-0 opacity-20 ${selectedLead?.id === lead.id ? 'text-white' : ''}`} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-30">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Nenhum lead encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* CHAT WINDOW INTERFACE */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#0f172a] rounded-[3rem] border border-slate-100 dark:border-slate-800/50 overflow-hidden shadow-2xl relative">
            {selectedLead ? (
              <>
                {/* Chat Header */}
                <div className="p-8 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/30 dark:bg-white/5">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                       <img src={selectedLead.profile_pic || ''} className="w-14 h-14 rounded-2xl border-4 border-white dark:border-slate-900 shadow-lg" alt=""/>
                       <div className="absolute -top-1 -right-1 p-1 bg-emerald-500 rounded-lg text-white shadow-lg">
                          <Shield size={10} strokeWidth={3} />
                       </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">{selectedLead.name}</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Canal Seguro</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all">
                        <Calendar size={20} />
                     </button>
                     <button className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
                        <Trash2 size={20} />
                     </button>
                  </div>
                </div>

                {/* Messages Stream */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-white dark:bg-[#0f172a]">
                  {messages.length > 0 ? (
                    messages.map((msg, i) => {
                      const isMe = msg.sender_id === selectedPage.fb_id;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-up`}>
                          <div className={`
                            px-6 py-4 rounded-[2rem] text-[13px] font-bold max-w-[80%] lg:max-w-[60%] leading-relaxed shadow-sm
                            ${isMe 
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20' 
                              : 'bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800/50 rounded-tl-none'
                            }
                          `}>
                            {msg.text}
                          </div>
                          <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-2 px-2">
                             {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                       <MessageSquare size={64} strokeWidth={1} className="mb-6" />
                       <p className="text-sm font-black uppercase tracking-widest">Nenhuma mensagem no log</p>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="relative flex items-center gap-4 bg-white dark:bg-[#0f172a] border-2 border-slate-100 dark:border-slate-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 rounded-[2rem] p-2 transition-all">
                    <input 
                      type="text" 
                      placeholder="Type a stealth reply..."
                      value={inputText} 
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 bg-transparent border-none px-6 py-3 text-sm font-bold dark:text-white outline-none placeholder-slate-300"
                    />
                    <button 
                      onClick={handleSendMessage} 
                      className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
                    >
                      <Send size={18} className="translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center animate-fade-in">
                <div className="relative mb-10">
                   <div className="absolute -inset-6 bg-indigo-500/10 rounded-full blur-2xl"></div>
                   <div className="relative w-24 h-24 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-slate-400">
                      <MessageSquare size={40} strokeWidth={1.5} />
                   </div>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase mb-2">Central de Comunicação</h3>
                <p className="text-sm font-medium text-slate-400 max-w-xs leading-relaxed">
                   Selecione um lead da lista lateral para visualizar o histórico de conversas e responder via Stealth Direct.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-8 animate-fade-up pr-1 custom-scrollbar">
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Leads */}
            <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-2xl">
                <Users size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Total Leads</span>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{leads.length}</h4>
              </div>
            </div>

            {/* Total Executions */}
            <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-2xl">
                <Zap size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Automações Iniciadas</span>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.totalExecutions}</h4>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Taxa de Resposta</span>
                <div className="flex items-center gap-2 mt-1">
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">{metrics.conversionRate}%</h4>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[60px]">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics.conversionRate}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Waiting Leads */}
            <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Aguardando Resposta (24h)</span>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.waiting}</h4>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="bg-white dark:bg-[#0f172a] rounded-[3rem] border border-slate-100 dark:border-white/5 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 font-sans">Fluxo de Mensagens Recentes</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Acompanhamento de envios de automações em tempo real</p>
              </div>
              <button 
                onClick={loadDashboardMetrics}
                className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-650 dark:text-white rounded-2xl transition-all"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-white/5">
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead (PSID)</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fluxo</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapa Atual</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50 dark:divide-white/5">
                  {flowExecutions.map((exec) => {
                    const flow = exec.fb_flows as any;
                    const stepsCount = flow?.steps?.length || 0;
                    const isWaiting = exec.error_message?.includes('Janela') || exec.error_message?.includes('interação');
                    const statusLabel = isWaiting ? 'Aguardando' : exec.status;

                    return (
                      <tr key={exec.id} className="hover:bg-slate-50/30 dark:hover:bg-white/1 text-xs">
                        <td className="py-4 font-bold text-slate-800 dark:text-slate-100">
                          <span className="block">{exec.lead_psid}</span>
                        </td>
                        <td className="py-4 font-bold text-indigo-650 dark:text-indigo-400">
                          {flow?.name || "Fluxo Geral"}
                        </td>
                        <td className="py-4 font-bold text-slate-650 dark:text-slate-400">
                          Passo {exec.current_step_index} de {stepsCount}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-block ${
                            exec.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                              : exec.status === 'failed' && !isWaiting
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300'
                              : isWaiting
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300'
                          }`}>
                            {statusLabel}
                          </span>
                          {exec.status === 'failed' && !isWaiting && (
                            <span className="block text-[10px] text-rose-450 mt-1 font-bold">{exec.error_message}</span>
                          )}
                        </td>
                        <td className="py-4 text-slate-400 font-bold">
                          {new Date(exec.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {flowExecutions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                        Nenhum envio de fluxo registrado para esta página.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* AUTO-REPLY MODAL REDESIGN */}
      {isAutomationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-fade-up border border-slate-100 dark:border-white/5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-50 dark:border-white/5">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20">
                       <Zap size={20} />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">Auto-Reply Hub</h3>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Automação Inteligente de Comentários</p>
                    </div>
                 </div>
                 <button onClick={() => setIsAutomationModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><X size={24}/></button>
              </div>
              
              <div className="space-y-8 mb-12">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">Trigger Keyword</label>
                       <input 
                         type="text" 
                         placeholder="Ex: 'eu quero', 'preço'..."
                         value={newAuto.trigger_keyword} 
                         onChange={e => setNewAuto({...newAuto, trigger_keyword: e.target.value})}
                         className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">Direct Reply</label>
                       <input 
                         type="text"
                         placeholder="Sua resposta automática..."
                         value={newAuto.reply_message} 
                         onChange={e => setNewAuto({...newAuto, reply_message: e.target.value})}
                         className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                       />
                    </div>
                 </div>
                 <button 
                   onClick={handleSaveAutomation}
                   disabled={isProcessingAction || !newAuto.reply_message}
                   className="w-full bg-indigo-600 text-white py-5 rounded-[1.75rem] font-black uppercase tracking-widest text-xs hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-30 flex items-center justify-center gap-3"
                 >
                   {isProcessingAction ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18}/>} Criar Nova Regra
                 </button>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Regras Operacionais ({automations.length})</span>
                 </div>
                 <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {automations.map(a => (
                      <div key={a.id} className="group p-5 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-slate-800/50 rounded-3xl flex items-center justify-between transition-all hover:bg-white dark:hover:bg-slate-900 hover:shadow-lg">
                         <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                               <Hash size={20} />
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1.5">
                                 {a.trigger_keyword ? `"${a.trigger_keyword}"` : "Qualquer Comentário"}
                               </p>
                               <p className="text-[11px] font-bold text-slate-400 truncate max-w-[300px]">{a.reply_message}</p>
                            </div>
                         </div>
                         <button onClick={() => handleDeleteAuto(a.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={18}/>
                         </button>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST MODAL REDESIGN */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-lg rounded-[3rem] p-12 shadow-2xl animate-fade-up border border-slate-100 dark:border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 blur-[80px] rounded-full"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-500/20">
                       <Megaphone size={22} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Disparo em Massa</h3>
                 </div>
                 <button onClick={() => setIsBroadcastModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24}/></button>
              </div>
              
              <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/30 mb-8 flex items-start gap-4">
                 <AlertTriangle size={24} className="text-rose-600 shrink-0 mt-1" />
                 <div>
                    <p className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest leading-relaxed">
                       Você está prestes a notificar {selectedLeadIds.size} leads selecionados.
                    </p>
                    <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-wider opacity-80">
                       Disparos rápidos podem comprometer a integridade da conta. Use com inteligência.
                    </p>
                 </div>
              </div>

              <div className="space-y-4 mb-10">
                 <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest ml-1">Conteúdo do Aviso</label>
                 <textarea 
                   rows={5}
                   placeholder="Olá! Temos uma novidade imperdível para você..."
                   value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)}
                   className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800 rounded-[2rem] p-8 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all resize-none"
                 />
              </div>

              <button 
                onClick={handleSendBroadcast}
                disabled={isProcessingAction || !broadcastMessage.trim()}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-4"
              >
                {isProcessingAction ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} 
                {isProcessingAction ? 'Executando Disparo...' : 'Iniciar Operação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOWS MODAL DESIGN */}
      {isFlowModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-[1350px] h-[85vh] rounded-[3rem] p-10 shadow-2xl animate-fade-up border border-slate-100 dark:border-white/5 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50 dark:border-white/5 shrink-0">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20">
                     <Users size={20} />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">Chatbot Flows</h3>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fluxos Inteligentes de Mensagem (Mídia & Delay)</p>
                  </div>
               </div>
               <button onClick={() => { setIsFlowModalOpen(false); setEditingFlow(null); }} className="relative z-10 w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><X size={24}/></button>
            </div>
            
              <div className="flex-1 flex gap-8 overflow-hidden">
                {/* Left Side: Flows List */}
                <div className="w-[260px] shrink-0 flex flex-col border-r border-slate-100 dark:border-white/5 pr-6 overflow-y-auto">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Fluxos ({flows.length})</span>
                    <button 
                      onClick={handleCreateNewFlow}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-750 transition-all shadow-md"
                    >
                      <Plus size={14} /> Novo
                    </button>
                  </div>
                  
                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                    {flows.map(f => (
                      <div 
                        key={f.id} 
                        onClick={() => setEditingFlow(f)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                          editingFlow?.id === f.id 
                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-850' 
                            : 'bg-slate-50/50 border-slate-100 dark:bg-white/5 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                            {f.trigger_type === 'all' ? 'Qualquer comentário' : `Gatilho: "${f.trigger_keyword}"`}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteFlowData(f.id); }} 
                          className="p-2 text-slate-350 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {flows.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nenhum fluxo criado.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Editor */}
                <div className="flex-1 flex flex-col overflow-y-auto">
                  {editingFlow ? (
                    <div className="flex-1 flex gap-6 overflow-hidden pr-2">
                      <div className="flex-1 flex flex-col overflow-y-auto pr-2">
                      {/* Flow Config */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shrink-0">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nome do Fluxo</label>
                          <input 
                            type="text" 
                            value={editingFlow.name}
                            onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-850 dark:text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gatilho de Entrada</label>
                          <div className="flex gap-2">
                            <select 
                              value={editingFlow.trigger_type}
                              onChange={e => setEditingFlow({ ...editingFlow, trigger_type: e.target.value })}
                              className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-850 dark:text-white outline-none cursor-pointer"
                            >
                              <option value="all">Qualquer comentário</option>
                              <option value="keyword">Palavra-Chave</option>
                            </select>
                            {editingFlow.trigger_type === 'keyword' && (
                              <input 
                                type="text"
                                placeholder="Ex: eu quero"
                                value={editingFlow.trigger_keyword || ''}
                                onChange={e => setEditingFlow({ ...editingFlow, trigger_keyword: e.target.value })}
                                className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-850 dark:text-white"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Page Selection Checkboxes */}
                      <div className="mb-6 p-5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-850 rounded-[2rem] shrink-0">
                         <div className="flex justify-between items-center mb-3">
                           <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Atribuir Páginas ao Fluxo</label>
                           <div className="flex items-center gap-3">
                             {allPages.length > 0 && (
                               <button 
                                 type="button"
                                 onClick={() => {
                                   const allIds = allPages.map((p: any) => p.fb_id);
                                   const currentIds = editingFlow.page_ids || [];
                                   const isAllSelected = allIds.every(id => currentIds.includes(id));
                                   setEditingFlow({
                                     ...editingFlow,
                                     page_ids: isAllSelected ? [] : allIds
                                   });
                                 }}
                                 className="text-[9px] font-black text-indigo-500 hover:text-indigo-650 uppercase tracking-wider transition-all"
                               >
                                 {allPages.map((p: any) => p.fb_id).every(id => (editingFlow.page_ids || []).includes(id)) ? 'Desmarcar Todas' : 'Selecionar Todas'}
                               </button>
                             )}
                             <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                               {(editingFlow.page_ids || []).length} selecionadas
                             </span>
                           </div>
                         </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                          {allPages.map((page: any) => {
                            const isChecked = editingFlow.page_ids?.includes(page.fb_id) || false;
                            return (
                              <div 
                                key={page.fb_id} 
                                onClick={() => {
                                  const currentIds = editingFlow.page_ids || [];
                                  const updatedIds = isChecked
                                    ? currentIds.filter((id: string) => id !== page.fb_id)
                                    : [...currentIds, page.fb_id];
                                  setEditingFlow({ ...editingFlow, page_ids: updatedIds });
                                }}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${
                                  isChecked 
                                    ? 'bg-indigo-600 border-indigo-650 text-white shadow-sm shadow-indigo-500/20' 
                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isChecked ? 'bg-white border-white text-indigo-600' : 'border-slate-300 dark:border-slate-700'}`}>
                                  {isChecked && <Check size={10} strokeWidth={4} />}
                                </div>
                                <span className="truncate">{page.name}</span>
                              </div>
                            );
                          })}
                          {allPages.length === 0 && (
                            <span className="text-xs font-bold text-slate-400 col-span-full text-center py-4">Nenhuma página encontrada. Conecte uma conta.</span>
                          )}
                        </div>
                      </div>

                      {/* Steps List */}
                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 py-2 border-t border-slate-50 dark:border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sequência do Fluxo ({editingFlow.steps.length} passos)</span>
                        </div>
                        
                        {editingFlow.steps.map((step: any, index: number) => (
                          <div key={index} className="p-5 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-slate-850 rounded-2xl relative group/step flex flex-col gap-4">
                            {/* Step Header */}
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/30">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                                <span className="text-xs font-black uppercase text-indigo-500 tracking-wider font-mono">[{step.type}]</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  disabled={index === 0}
                                  onClick={() => handleStepOrderChange(index, 'up')}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button 
                                  disabled={index === editingFlow.steps.length - 1}
                                  onClick={() => handleStepOrderChange(index, 'down')}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded disabled:opacity-30"
                                >
                                  ↓
                                </button>
                                <button 
                                  onClick={() => handleRemoveStepFromFlow(index)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Step Body based on type */}                            {step.type === 'text' && (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Texto da Mensagem</label>
                                  <textarea 
                                    rows={3}
                                    placeholder="Digite sua mensagem de texto..."
                                    value={step.text || ''}
                                    onChange={e => handleUpdateStep(index, { text: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-white"
                                  />
                                </div>
                                
                                {/* Botões da mensagem */}
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Botões de Ação (Max 3)</label>
                                    {(!step.buttons || step.buttons.length < 3) && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const currentButtons = step.buttons || [];
                                          handleUpdateStep(index, { 
                                            buttons: [...currentButtons, { title: 'Ver Site', type: 'web_url', url: '' }] 
                                          });
                                        }}
                                        className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 uppercase tracking-wider"
                                      >
                                        + Adicionar Botão
                                      </button>
                                    )}
                                  </div>
                                  
                                  {(step.buttons || []).map((btn: any, btnIdx: number) => (
                                    <div key={btnIdx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2 relative group/btn">
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const updatedBtns = step.buttons.filter((_: any, bi: number) => bi !== btnIdx);
                                          handleUpdateStep(index, { buttons: updatedBtns });
                                        }}
                                        className="absolute right-2 top-2 text-slate-400 hover:text-rose-500 rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                      
                                      <span className="text-[8px] font-black text-slate-400 uppercase">Botão #{btnIdx + 1}</span>
                                      
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <input 
                                            type="text" 
                                            placeholder="Título do Botão"
                                            value={btn.title || ''}
                                            onChange={e => {
                                              const updatedBtns = [...step.buttons];
                                              updatedBtns[btnIdx].title = e.target.value;
                                              handleUpdateStep(index, { buttons: updatedBtns });
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <select
                                            value={btn.type || 'web_url'}
                                            onChange={e => {
                                              const updatedBtns = [...step.buttons];
                                              updatedBtns[btnIdx].type = e.target.value;
                                              if (e.target.value === 'postback') {
                                                updatedBtns[btnIdx].payload = updatedBtns[btnIdx].payload || 'BOTAO_CLICADO';
                                                delete updatedBtns[btnIdx].url;
                                              } else {
                                                updatedBtns[btnIdx].url = updatedBtns[btnIdx].url || '';
                                                delete updatedBtns[btnIdx].payload;
                                              }
                                              handleUpdateStep(index, { buttons: updatedBtns });
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
                                          >
                                            <option value="web_url">Abrir Link</option>
                                            <option value="postback">Enviar Texto</option>
                                          </select>
                                        </div>
                                      </div>
                                      
                                      {btn.type !== 'postback' ? (
                                        <div className="space-y-1">
                                          <input 
                                            type="text" 
                                            placeholder="Link (https://...)"
                                            value={btn.url || ''}
                                            onChange={e => {
                                              const updatedBtns = [...step.buttons];
                                              updatedBtns[btnIdx].url = e.target.value;
                                              handleUpdateStep(index, { buttons: updatedBtns });
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <input 
                                            type="text" 
                                            placeholder="Texto que o lead vai responder (ex: SIM)"
                                            value={btn.payload || ''}
                                            onChange={e => {
                                              const updatedBtns = [...step.buttons];
                                              updatedBtns[btnIdx].payload = e.target.value;
                                              handleUpdateStep(index, { buttons: updatedBtns });
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}                            {(step.type === 'image' || step.type === 'audio') && (
                              <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">URL do Arquivo ({step.type === 'image' ? 'Imagem' : 'Áudio'})</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Cole a URL ou suba um arquivo..."
                                    value={step.media_url || ''}
                                    onChange={e => handleUpdateStep(index, { media_url: e.target.value })}
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                                  />
                                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl flex items-center justify-center cursor-pointer select-none">
                                    {isUploadingFile ? <Loader2 size={14} className="animate-spin" /> : 'Upload'}
                                    <input 
                                      type="file"
                                      accept={step.type === 'image' ? 'image/*' : 'audio/*'}
                                      onChange={e => handleFileUpload(e, index)}
                                      className="hidden"
                                      disabled={isUploadingFile}
                                    />
                                  </label>
                                </div>
                                {step.media_url && step.type === 'image' && (
                                  <img src={step.media_url} alt="preview" className="h-20 w-auto rounded-xl object-cover border border-slate-100 dark:border-slate-800" />
                                )}
                                {step.media_url && step.type === 'audio' && (
                                  <audio src={step.media_url} controls className="w-full h-8" />
                                )}
                              </div>
                            )}

                            {step.type === 'delay' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tempo de Espera</label>
                                  <input 
                                    type="number"
                                    value={step.delay_value || ''}
                                    onChange={e => handleUpdateStep(index, { delay_value: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Unidade</label>
                                  <select 
                                    value={step.delay_unit || 'seconds'}
                                    onChange={e => handleUpdateStep(index, { delay_unit: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
                                  >
                                    <option value="seconds">Segundos</option>
                                    <option value="minutes">Minutos</option>
                                    <option value="hours">Horas</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {step.type === 'card' && (
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cards no Carrossel</label>
                                  <button 
                                    onClick={() => {
                                      const updatedCards = [...(step.cards || []), { title: '', subtitle: '', image_url: '', button_title: '', button_url: '' }];
                                      handleUpdateStep(index, { cards: updatedCards });
                                    }}
                                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-wider"
                                  >
                                    + Add Card
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  {(step.cards || []).map((card: any, cardIdx: number) => (
                                    <div key={cardIdx} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 relative group/card">
                                      {/* Card header */}
                                      <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/30">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Card #{cardIdx + 1}</span>
                                        {step.cards.length > 1 && (
                                          <button 
                                            onClick={() => {
                                              const updatedCards = step.cards.filter((_: any, ci: number) => ci !== cardIdx);
                                              handleUpdateStep(index, { cards: updatedCards });
                                            }}
                                            className="text-xs text-rose-500 hover:underline font-bold"
                                          >
                                            Excluir
                                          </button>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <input 
                                          type="text"
                                          placeholder="Título do Card"
                                          value={card.title || ''}
                                          onChange={e => {
                                            const updatedCards = [...step.cards];
                                            updatedCards[cardIdx].title = e.target.value;
                                            handleUpdateStep(index, { cards: updatedCards });
                                          }}
                                          className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                                        />
                                        <input 
                                          type="text"
                                          placeholder="Subtítulo do Card"
                                          value={card.subtitle || ''}
                                          onChange={e => {
                                            const updatedCards = [...step.cards];
                                            updatedCards[cardIdx].subtitle = e.target.value;
                                            handleUpdateStep(index, { cards: updatedCards });
                                          }}
                                          className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                                        />
                                      </div>

                                      {/* Image upload inside card */}
                                      <div className="flex gap-2">
                                        <input 
                                          type="text"
                                          placeholder="Imagem URL"
                                          value={card.image_url || ''}
                                          onChange={e => {
                                            const updatedCards = [...step.cards];
                                            updatedCards[cardIdx].image_url = e.target.value;
                                            handleUpdateStep(index, { cards: updatedCards });
                                          }}
                                          className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                                        />
                                        <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center justify-center cursor-pointer select-none">
                                          {isUploadingFile ? <Loader2 size={12} className="animate-spin" /> : 'Upload'}
                                          <input 
                                            type="file"
                                            accept="image/*"
                                            onChange={e => handleFileUpload(e, index, cardIdx)}
                                            className="hidden"
                                            disabled={isUploadingFile}
                                          />
                                        </label>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <input 
                                          type="text"
                                          placeholder="Texto do Botão"
                                          value={card.button_title || ''}
                                          onChange={e => {
                                            const updatedCards = [...step.cards];
                                            updatedCards[cardIdx].button_title = e.target.value;
                                            handleUpdateStep(index, { cards: updatedCards });
                                          }}
                                          className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                                        />
                                        <input 
                                          type="text"
                                          placeholder="Link do Botão (URL)"
                                          value={card.button_url || ''}
                                          onChange={e => {
                                            const updatedCards = [...step.cards];
                                            updatedCards[cardIdx].button_url = e.target.value;
                                            handleUpdateStep(index, { cards: updatedCards });
                                          }}
                                          className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Step Buttons */}
                      <div className="grid grid-cols-5 gap-2 mt-4 shrink-0 p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-850 rounded-2xl">
                        <button onClick={() => handleAddStepToFlow('text')} className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-white dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-150 hover:shadow-sm">
                          <MessageSquare size={16} className="text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Texto</span>
                        </button>
                        <button onClick={() => handleAddStepToFlow('image')} className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-white dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-150 hover:shadow-sm">
                          <ImageIcon size={16} className="text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Imagem</span>
                        </button>
                        <button onClick={() => handleAddStepToFlow('audio')} className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-white dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-150 hover:shadow-sm">
                          <Terminal size={16} className="text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Áudio</span>
                        </button>
                        <button onClick={() => handleAddStepToFlow('card')} className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-white dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-150 hover:shadow-sm">
                          <Globe size={16} className="text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Card</span>
                        </button>
                        <button onClick={() => handleAddStepToFlow('delay')} className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-white dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-150 hover:shadow-sm">
                          <Clock size={16} className="text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Delay</span>
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-4 mt-6 shrink-0 border-t border-slate-50 dark:border-white/5 pt-4">
                        <button 
                          onClick={() => setEditingFlow(null)}
                          className="flex-1 py-4 border border-slate-100 dark:border-slate-800 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleSaveFlowData}
                          disabled={isProcessingAction || editingFlow.steps.length === 0}
                          className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/10 disabled:opacity-30"
                        >
                          {isProcessingAction ? 'Salvando...' : 'Salvar Fluxo'}
                        </button>
                      </div>
                    </div>
                      
                      {/* Live Preview Panel (Phone Mockup) */}
                      <div className="w-[320px] shrink-0 hidden xl:flex flex-col border-l border-slate-100 dark:border-white/5 pl-6 overflow-hidden">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Prévia no Messenger</span>
                        
                        {/* Smartphone Frame */}
                        <div className="flex-1 border-4 border-slate-250 dark:border-slate-850 rounded-[2.5rem] overflow-hidden flex flex-col bg-[#f4f4f5] dark:bg-slate-950 relative shadow-inner">
                          {/* Phone Top Notch */}
                          <div className="h-6 bg-slate-200 dark:bg-slate-800 flex justify-center items-center gap-1.5 shrink-0">
                            <div className="w-12 h-3.5 bg-black rounded-full"></div>
                          </div>

                          {/* Chat Header */}
                          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                              {editingFlow.name ? editingFlow.name[0].toUpperCase() : 'F'}
                            </div>
                            <div className="truncate">
                              <h4 className="text-[11px] font-black text-slate-850 dark:text-white truncate leading-tight">
                                {editingFlow.name || 'Novo Fluxo'}
                              </h4>
                              <span className="text-[8px] font-black uppercase text-emerald-500 tracking-wider">Online</span>
                            </div>
                          </div>

                          {/* Chat Message Logs */}
                          <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar flex flex-col">
                            {editingFlow.trigger_type === 'keyword' && editingFlow.trigger_keyword && (
                              <div className="self-end max-w-[80%] bg-indigo-600 text-white px-3 py-2 rounded-2xl rounded-tr-none text-xs font-bold shadow-sm shadow-indigo-500/10">
                                {editingFlow.trigger_keyword}
                              </div>
                            )}

                            {editingFlow.steps.map((step: any, sIdx: number) => {
                              const previewName = "João Silva";
                              const formatPreviewText = (rawText: string, fullName: string) => {
                                if (!rawText) return "";
                                const firstName = fullName.split(' ')[0] || fullName;
                                return rawText
                                  .replace(/\{\{nome\}\}/gi, fullName)
                                  .replace(/\{\{name\}\}/gi, fullName)
                                  .replace(/\{\{primeiro_nome\}\}/gi, firstName)
                                  .replace(/\{\{first_name\}\}/gi, firstName);
                              };
                              if (step.type === 'text') {
                                return (
                                  <div key={sIdx} className="flex gap-2 max-w-[85%] self-start items-end flex-col align-start w-full">
                                    <div className="flex gap-2 items-end w-full">
                                      <div className="w-5 h-5 rounded-full bg-indigo-650 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                        {editingFlow.name ? editingFlow.name[0].toUpperCase() : 'F'}
                                      </div>
                                      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-2.5 rounded-2xl rounded-tl-none text-xs font-medium shadow-sm border border-slate-100 dark:border-slate-850 break-words text-left flex-1">
                                        {formatPreviewText(step.text, previewName) || <span className="italic text-slate-400">Texto vazio...</span>}
                                      </div>
                                    </div>
                                    {step.buttons && step.buttons.length > 0 && (
                                      <div className="w-full pl-7 space-y-1 mt-1 text-left">
                                        {step.buttons.map((btn: any, bIdx: number) => (
                                          <div 
                                            key={bIdx} 
                                            className="w-full py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-center text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider"
                                          >
                                            {btn.title || `Botão #${bIdx + 1}`}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              if (step.type === 'image') {
                                return (
                                  <div key={sIdx} className="flex gap-2 max-w-[85%] self-start items-end">
                                    <div className="w-5 h-5 rounded-full bg-indigo-650 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {editingFlow.name ? editingFlow.name[0].toUpperCase() : 'F'}
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-850 shadow-sm">
                                      {step.media_url ? (
                                        <img src={step.media_url} alt="preview" className="rounded-xl max-h-36 object-cover max-w-full" />
                                      ) : (
                                        <div className="w-32 h-20 bg-slate-100 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center text-[8px] font-bold text-slate-400 uppercase tracking-widest gap-1">
                                          <ImageIcon size={16} /> Sem Imagem
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              if (step.type === 'audio') {
                                return (
                                  <div key={sIdx} className="flex gap-2 max-w-[85%] self-start items-end">
                                    <div className="w-5 h-5 rounded-full bg-indigo-650 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {editingFlow.name ? editingFlow.name[0].toUpperCase() : 'F'}
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-850 shadow-sm flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 shrink-0">
                                        ▶
                                      </div>
                                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex items-center gap-0.5">
                                        <div className="h-full bg-indigo-600 w-1/3 rounded-full"></div>
                                      </div>
                                      <span className="text-[8px] text-slate-400 font-bold">0:05</span>
                                    </div>
                                  </div>
                                );
                              }

                              if (step.type === 'delay') {
                                return (
                                  <div key={sIdx} className="self-center bg-slate-200/50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-150 dark:border-slate-800/30">
                                    <Clock size={10} /> {step.delay_value || 0} {step.delay_unit === 'seconds' ? 'seg' : step.delay_unit === 'minutes' ? 'min' : 'h'}
                                  </div>
                                );
                              }

                              if (step.type === 'card') {
                                return (
                                  <div key={sIdx} className="flex gap-2 max-w-[95%] self-start items-end">
                                    <div className="w-5 h-5 rounded-full bg-indigo-650 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                      {editingFlow.name ? editingFlow.name[0].toUpperCase() : 'F'}
                                    </div>
                                    <div className="flex-1 overflow-x-auto py-1 flex gap-2 max-w-full custom-scrollbar">
                                      {(step.cards || []).map((card: any, cIdx: number) => (
                                        <div key={cIdx} className="w-[180px] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-850 shadow-sm shrink-0 flex flex-col text-left">
                                          {card.image_url ? (
                                            <img src={card.image_url} alt="card" className="h-24 w-full object-cover shrink-0" />
                                          ) : (
                                            <div className="h-24 bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                                              Sem Imagem
                                            </div>
                                          )}
                                          <div className="p-2.5 flex-1 flex flex-col justify-between">
                                            <div>
                                              <h5 className="text-[10px] font-black text-slate-850 dark:text-white leading-tight truncate">{formatPreviewText(card.title, previewName) || 'Título...'}</h5>
                                              <p className="text-[8px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{formatPreviewText(card.subtitle, previewName) || 'Subtítulo...'}</p>
                                            </div>
                                            {card.button_title && (
                                              <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/30 text-center">
                                                <span className="inline-block w-full py-1 text-[8px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/30">
                                                  {formatPreviewText(card.button_title, previewName)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      {(step.cards || []).length === 0 && (
                                        <div className="w-[180px] p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 text-center text-[8px] text-slate-400 font-bold uppercase">
                                          Sem cards
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return null;
                            })}
                          </div>

                          {/* Chat Footer Mockup */}
                          <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
                            <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-full px-3 py-1.5 border border-slate-100 dark:border-slate-850 text-[10px] text-slate-400 font-bold">
                              Enviar mensagem...
                            </div>
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              ➔
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-150 dark:border-slate-800/80">
                      <Zap size={36} className="text-indigo-500/80 mb-3 animate-pulse" />
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Nenhum fluxo selecionado</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Selecione um fluxo na lista lateral ou clique em "Novo" para começar.</p>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsTab;
