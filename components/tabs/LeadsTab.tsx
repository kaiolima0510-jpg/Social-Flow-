
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
  fetchTotalLeadsCount
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const allPages = (accounts || []).flatMap(acc => (acc.pages || []).map((p: any) => ({ ...p, parentToken: acc.token })));

  useEffect(() => {
    loadTotalLeads();
    const interval = setInterval(loadTotalLeads, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPage) {
      loadLeads();
      loadAutomations();
    }
  }, [selectedPage]);

  const loadTotalLeads = async () => {
    const count = await fetchTotalLeadsCount();
    setTotalLeadsCount(count);
  };

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
          if (comment.from.id === selectedPage.fb_id) continue;
          
          const alreadyDone = await isCommentProcessed(comment.id);
          if (!alreadyDone) {
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
      if (res.message_id) await saveMessageLog(newMessage);
      else addSecurityLog(`FAIL: Erro 24h ou bloqueio no Messenger.`);
    } catch (e) { addSecurityLog(`FAIL: Erro ao enviar.`); }
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
    </div>
  );
};

export default LeadsTab;
