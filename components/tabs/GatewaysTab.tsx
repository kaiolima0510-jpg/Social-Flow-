
import React, { useMemo } from 'react';
import { Plus, Users, Target, Search, Layers, Trash2, Check, Globe, Zap, CheckSquare, Square, ChevronRight, Shield, ShieldCheck, Activity, RotateCcw } from 'lucide-react';
import { FacebookAccount, PageGroup } from '../../types';

interface GatewaysTabProps {
  accounts: FacebookAccount[];
  setIsImportModalOpen: (o: boolean) => void;
  onDisconnect: (id: string) => void;
  selectedPageIds: Set<string>;
  setSelectedPageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pageSearch: string;
  setPageSearch: (s: string) => void;
  pageGroups: PageGroup[];
  handleSelectGroup: (g: PageGroup) => void;
  deletePageGroup: (id: string) => Promise<void>;
  togglePageSelection: (id: string) => void;
  setIsGroupModalOpen: (o: boolean) => void;
  reSyncAccount: (acc: FacebookAccount) => Promise<void>;
  spintaxTemplates: string;
  setSpintaxTemplates: (s: string) => void;
}

const GatewaysTab: React.FC<GatewaysTabProps> = ({
  accounts, setIsImportModalOpen, onDisconnect,
  selectedPageIds, setSelectedPageIds, pageSearch, setPageSearch,
  pageGroups, handleSelectGroup, deletePageGroup, togglePageSelection,
  setIsGroupModalOpen, reSyncAccount,
  spintaxTemplates, setSpintaxTemplates
}) => {
  const allPages = useMemo(
    () => accounts.flatMap(acc => (acc.pages || [])),
    [accounts]
  );

  const filteredPages = useMemo(
    () => allPages.filter(p => p.name.toLowerCase().includes(pageSearch.toLowerCase())),
    [allPages, pageSearch]
  );

  const totalPages = allPages.length;
  const selectedCount = selectedPageIds.size;

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-up px-6 lg:px-12 pb-24">

      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Gateways Hub</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 flex items-center gap-2">
             <ShieldCheck size={12} /> Conectividade Segura v8.0
          </p>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="group relative bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-indigo-500/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all duration-300"
        >
          <Plus size={20} strokeWidth={3}/> Conectar Perfil
          <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>
      </div>

      {/* EMPTY STATE REDESIGN */}
      {accounts.length === 0 && (
        <div className="bg-white dark:bg-[#0f172a] p-24 rounded-[3.5rem] border border-slate-100 dark:border-slate-800/50 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full"></div>
          
          <div className="relative z-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-[2.5rem] flex items-center justify-center text-indigo-600 mb-8 mx-auto">
              <Globe size={48} strokeWidth={1.5}/>
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-4 uppercase">Sua Rede está Offline</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mb-12 text-lg">
              Conecte suas contas do Facebook para desbloquear o gerenciamento em massa e o monitoramento Stealth.
            </p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center gap-4 shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
            >
              <Zap size={20} fill="currentColor"/> Iniciar Conexão Segura
            </button>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="grid grid-cols-12 gap-10">

          {/* LEFT PANEL: ACTIVE PERFILES */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <Users size={16} className="text-slate-400"/>
              <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Perfis Operacionais</h4>
            </div>
            
            <div className="space-y-4">
              {accounts.map(acc => (
                <div key={acc.id} className="group bg-white dark:bg-[#0f172a] p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-5 mb-6">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 shadow-lg overflow-hidden shrink-0">
                      {(acc.pages && acc.pages[0]?.picture) ? (
                        <img src={acc.pages[0].picture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users size={24}/>
                      )}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className="text-base font-black text-slate-900 dark:text-white truncate leading-none mb-1.5">{acc.name}</p>
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acc.pages?.length || 0} canais integrados</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      className="flex-1 py-3 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                      onClick={() => onDisconnect(acc.id)}
                    >
                      Desvincular
                    </button>
                    <button
                      className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                      onClick={() => reSyncAccount(acc)}
                      title="Sincronizar Páginas"
                    >
                       <RotateCcw size={16} />
                    </button>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                       <Shield size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SPINTAX TEMPLATES CARD */}
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-5 animate-fade-up">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Zap size={20} strokeWidth={2.5}/>
                </div>
                <div>
                  <h4 className="text-[14px] font-black text-slate-900 dark:text-white leading-tight uppercase">Variações de Comentário</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Modelo Spintax Pré-Pronto</p>
                </div>
              </div>

              <textarea
                value={spintaxTemplates}
                onChange={e => setSpintaxTemplates(e.target.value)}
                rows={5}
                className="w-full bg-slate-50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/40 rounded-[2rem] px-5 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-y outline-none transition-all"
                placeholder="Ex: {Confira essa receita|Olha essa delícia|Veja que maravilhoso}"
              />
              <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">Cada comentário com variações ativas puxará uma frase deste modelo aleatoriamente antes do texto principal.</p>
            </div>
          </div>

          {/* RIGHT PANEL: TARGETING ENGINE */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            
            <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32"></div>
              
              <div className="relative z-10 space-y-10">
                {/* Targeting Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20">
                      <Target size={24}/>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2 uppercase">Direcionamento</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Filtragem & Segmentação de Canais</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                      <input
                        value={pageSearch}
                        onChange={e => setPageSearch(e.target.value)}
                        placeholder="Pesquisar canal..."
                        className="bg-slate-50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all w-64"
                      />
                    </div>

                    <button
                      onClick={() => setIsGroupModalOpen(true)}
                      disabled={selectedCount === 0}
                      className="h-[52px] bg-indigo-600 text-white px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-20 flex items-center gap-3"
                    >
                      <Layers size={18}/> Salvar Combo ({selectedCount})
                    </button>
                  </div>
                </div>

                {/* Selection Multi-tool */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-slate-50/50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setSelectedPageIds(new Set(allPages.map(p => p.fb_id)))}
                      className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all"
                    >
                      <CheckSquare size={16}/> Selecionar Tudo
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-800"></div>
                    <button
                      onClick={() => setSelectedPageIds(new Set())}
                      className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-rose-500 hover:scale-105 transition-all"
                    >
                      <Square size={16}/> Reset
                    </button>
                  </div>

                  {selectedCount > 0 && (
                    <div className="flex items-center gap-3 bg-emerald-500 text-white px-6 py-2.5 rounded-full shadow-lg shadow-emerald-500/20 animate-fade-up">
                      <Activity size={14}/>
                      <span className="text-[11px] font-black uppercase tracking-widest">{selectedCount} de {totalPages} Ativos</span>
                    </div>
                  )}
                </div>

                {/* Interactive Pages Grid */}
                {filteredPages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-3">
                    {filteredPages.map(page => {
                      const sel = selectedPageIds.has(page.fb_id);
                      return (
                        <label
                          key={page.fb_id}
                          className={`
                            relative group/card flex items-center gap-4 p-5 rounded-[2rem] border-2 cursor-pointer transition-all duration-300
                            ${sel
                              ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-600 shadow-md translate-x-1'
                              : 'bg-white dark:bg-white/5 border-slate-50 dark:border-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 hover:translate-x-1'
                            }
                          `}
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                            {page.picture ? (
                              <img src={page.picture} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Globe size={18}/>
                            )}
                          </div>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                            sel ? 'bg-indigo-600 border-indigo-600 text-white rotate-12' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a]'
                          }`}>
                            {sel && <Check size={14} strokeWidth={3}/>}
                          </div>
                          <input type="checkbox" className="hidden" checked={sel} onChange={() => togglePageSelection(page.fb_id)}/>
                          <div className="truncate flex-1 min-w-0">
                            <p className={`text-sm font-black truncate leading-tight ${sel ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>{page.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {page.fb_id}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-24 text-center opacity-30">
                    <Search size={48} className="mx-auto mb-4 opacity-20"/>
                    <p className="text-sm font-black uppercase tracking-[0.3em]">Canais não localizados</p>
                  </div>
                )}
              </div>
            </div>

            {/* SAVED COMBOS REDESIGN */}
            {pageGroups.length > 0 && (
              <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-8">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="text-slate-400"/>
                  <h4 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.25em]">Combos Estratégicos ({pageGroups.length})</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pageGroups.map(g => (
                    <div
                      key={g.id}
                      className="group flex items-center justify-between p-5 bg-slate-50/50 dark:bg-white/5 border border-slate-50 dark:border-slate-800/50 rounded-[2rem] hover:bg-white dark:hover:bg-slate-900 hover:shadow-xl hover:border-indigo-500/20 transition-all duration-500"
                    >
                      <button onClick={() => handleSelectGroup(g)} className="flex items-center gap-5 flex-1 text-left">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 dark:border-slate-700 shrink-0 group-hover:rotate-6 transition-transform">
                          <Layers size={22}/>
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight mb-1">{g.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.page_ids.length} canais ativos</p>
                        </div>
                      </button>
                      <button
                        onClick={() => deletePageGroup(g.id)}
                        className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GatewaysTab;
