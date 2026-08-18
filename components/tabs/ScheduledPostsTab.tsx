import React, { useEffect, useState } from 'react';
import { fetchPostQueue, deletePostQueueItem, supabase } from '../../services/supabaseService';
import { Tab } from '../../types';
import { 
  Calendar, Trash2, Globe, AlertCircle, Clock, CheckCircle2, 
  Search, RefreshCw, Layers, FileText, ChevronDown, ChevronUp, Play
} from 'lucide-react';

const ScheduledPostsTab: React.FC<{ activeTab: Tab; setActiveTab: (t: Tab) => void }> = ({ activeTab, setActiveTab }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchPostQueue();
      // Em posts agendados, priorizamos mostrar tudo da fila de posts do Facebook.
      setPosts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === Tab.SCHEDULED_POSTS) {
      loadPosts();
    }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar e remover este post da fila?')) return;
    try {
      await deletePostQueueItem(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Erro ao deletar post:", error);
      alert("Erro ao excluir o post.");
    }
  };

  const toggleLogs = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.caption?.toLowerCase().includes(search.toLowerCase()) || 
                          p.label?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats calculation
  const totalCount = posts.length;
  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const processingCount = posts.filter(p => p.status === 'processing').length;
  const doneCount = posts.filter(p => p.status === 'done').length;
  const errorCount = posts.filter(p => p.status === 'error').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock size={12} className="animate-pulse" />
            Pendente
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <RefreshCw size={12} className="animate-spin" />
            Processando
          </span>
        );
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            Concluído
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle size={12} />
            Erro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-500/10 text-slate-500 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Posts Agendados
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fila de postagens e histórico de publicação no Facebook.
          </p>
        </div>
        
        <button
          onClick={loadPosts}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Carregando...' : 'Atualizar Fila'}
        </button>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest block">Total na Fila</span>
          <span className="text-3xl font-black text-slate-900 dark:text-white mt-2 block">{totalCount}</span>
        </div>
        <div className="p-5 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
          <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block">Pendentes</span>
          <span className="text-3xl font-black text-amber-500 mt-2 block">{pendingCount}</span>
        </div>
        <div className="p-5 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
          <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">Processando</span>
          <span className="text-3xl font-black text-indigo-500 mt-2 block">{processingCount}</span>
        </div>
        <div className="p-5 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
          <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest block">Sucessos</span>
          <span className="text-3xl font-black text-emerald-500 mt-2 block">{doneCount}</span>
        </div>
        <div className="p-5 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-widest block">Falhas</span>
          <span className="text-3xl font-black text-rose-500 mt-2 block">{errorCount}</span>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por legenda ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm"
          />
        </div>
        
        <div className="flex gap-2">
          {['all', 'pending', 'processing', 'done', 'error'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all select-none border ${
                statusFilter === status
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-md'
                  : 'bg-transparent border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              {status === 'all' ? 'Todos' : 
               status === 'pending' ? 'Pendente' :
               status === 'processing' ? 'Processando' :
               status === 'done' ? 'Concluído' : 'Erro'}
            </button>
          ))}
        </div>
      </div>

      {/* POSTS LISTING */}
      {loading && posts.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 w-full skeleton rounded-3xl" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
          <Calendar size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhum post agendado</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mt-1">
            Não há publicações na fila correspondentes aos filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((p) => {
            const hasMedia = p.media_urls && p.media_urls.length > 0;
            const targetPages = p.pages || [];
            
            return (
              <div 
                key={p.id} 
                className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden card-hover hover:border-slate-200 dark:hover:border-slate-700/50"
              >
                {/* Main Card Header */}
                <div className="p-6 flex flex-col lg:flex-row gap-6">
                  {/* Left Side: Type, Badge & Date */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(p.status)}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-500 uppercase tracking-widest border border-indigo-500/10">
                        {p.type || 'Post'}
                      </span>
                      {p.is_scheduled && p.scheduled_date && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <Calendar size={12} />
                          {new Date(p.scheduled_date).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {p.label && (
                        <h4 className="text-md font-bold text-slate-800 dark:text-slate-200 leading-tight">
                          {p.label}
                        </h4>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal whitespace-pre-wrap break-all line-clamp-3">
                        {p.caption || 'Sem legenda'}
                      </p>
                    </div>

                    {/* Target Pages */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Globe size={10} />
                        Páginas Alvo ({targetPages.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {targetPages.map((page: any, idx: number) => (
                          <span 
                            key={idx} 
                            className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {page.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Media, Progress & Actions */}
                  <div className="lg:w-80 flex flex-col justify-between items-stretch gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800/80 pt-4 lg:pt-0 lg:pl-6">
                    {/* Media Previews */}
                    {hasMedia ? (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mídia Anexada</span>
                        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                          {p.media_urls.map((url: string, idx: number) => (
                            <img 
                              key={idx} 
                              src={url} 
                              alt="Media attached" 
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm shrink-0 hover:scale-105 transition duration-200" 
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-14 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Sem mídia</span>
                      </div>
                    )}

                    {/* Progress Bar (if processing or done/error count exists) */}
                    {p.progress_total > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-400 uppercase tracking-widest">Progresso</span>
                          <span className="text-slate-900 dark:text-white">
                            {p.progress_current || 0} / {p.progress_total} Páginas
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.round(((p.progress_current || 0) / p.progress_total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                     {/* Actions Panel */}
                     <div className="flex flex-col gap-2 mt-auto">
                       {p.status === 'pending' && (
                         <div className="flex items-center gap-2">
                           <input 
                             type="datetime-local" 
                             defaultValue={p.scheduled_date ? p.scheduled_date.slice(0, 16) : ""}
                             onChange={(e) => {
                               setPosts(prev => prev.map(post => 
                                 post.id === p.id ? { ...post, _new_date: e.target.value } : post
                               ));
                             }}
                             className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[10px] text-slate-800 dark:text-white"
                           />
                           <button
                             onClick={async () => {
                               if (!p._new_date) {
                                 alert("Por favor, selecione uma data válida.");
                                 return;
                               }
                               try {
                                 const { error } = await supabase
                                   .from('post_queue')
                                   .update({ scheduled_date: p._new_date, status: 'pending' })
                                   .eq('id', p.id);
                                 if (error) throw error;
                                 alert("Data e hora atualizadas com sucesso!");
                                 loadPosts();
                               } catch (e: any) {
                                 alert("Erro ao reagendar: " + e.message);
                               }
                             }}
                             className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-black text-[10px] uppercase tracking-wider transition active:scale-95"
                           >
                             Reagendar
                           </button>
                         </div>
                       )}
                       
                       <div className="flex items-center gap-2">
                         {p.status === 'pending' && (
                           <button
                             onClick={async () => {
                               if (!window.confirm("Deseja postar este conteúdo agora mesmo?")) return;
                               try {
                                 const { error } = await supabase
                                   .from('post_queue')
                                   .update({ 
                                     status: 'pending', 
                                     is_scheduled: false, 
                                     scheduled_date: '',
                                     logs: ['[Immediate Trigger] Publicação imediata iniciada via Painel do Usuário.'] 
                                   })
                                   .eq('id', p.id);
                                 if (error) throw error;
                                 alert("Publicação imediata ativada! O robô iniciou o processamento.");
                                 loadPosts();
                               } catch (e: any) {
                                 alert("Erro ao iniciar postagem imediata: " + e.message);
                               }
                             }}
                             className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition text-xs shadow-md shadow-indigo-600/10 active:scale-95"
                           >
                             <Play size={12} fill="white" />
                             Postar Agora
                           </button>
                         )}
                         
                         {p.logs && p.logs.length > 0 && (
                           <button
                             onClick={() => toggleLogs(p.id)}
                             className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-xs"
                           >
                             {expandedLogs[p.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                             Logs
                           </button>
                         )}
                         
                         <button
                           onClick={() => handleDelete(p.id)}
                           className="p-2.5 rounded-xl border border-rose-100 dark:border-rose-950/20 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/15 transition-colors shrink-0"
                           title="Cancelar e Excluir Post"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </div>
                  </div>
                </div>

                {/* Expanded Logs Panel */}
                {expandedLogs[p.id] && p.logs && p.logs.length > 0 && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={12} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logs de Execução</span>
                    </div>
                    <div className="bg-slate-950 dark:bg-black/60 p-4 rounded-2xl font-mono text-[10px] text-slate-300 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar border border-white/5 shadow-inner">
                      {p.logs.map((log: string, idx: number) => (
                        <div key={idx} className="flex gap-2.5">
                          <span className="text-slate-600 font-bold shrink-0">{idx + 1}.</span>
                          <span className={
                            log.includes('[OK]') || log.includes('Success') ? 'text-emerald-400' :
                            log.includes('[FAIL]') || log.includes('Error') || log.includes('[CRITICAL ERROR]') ? 'text-rose-400' :
                            log.includes('[PostQueue] Starting') ? 'text-indigo-400 font-bold' :
                            'text-slate-400'
                          }>
                            {log}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduledPostsTab;
