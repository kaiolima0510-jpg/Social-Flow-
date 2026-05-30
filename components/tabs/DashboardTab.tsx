
import React from 'react';
import { Users, BarChart3, Heart, Zap, ShieldCheck, TrendingUp, Info, Layout, ArrowUpRight, MousePointer2, Globe } from 'lucide-react';

interface DashboardTabProps {
  realPageMetrics: any[];
  stealthStats: { totalTokens: number; integrity: number };
  isProcessing: boolean;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ realPageMetrics, stealthStats, isProcessing }) => {
  const isLoading = isProcessing;
  const totalFans = realPageMetrics.reduce((acc, p) => acc + (p.fans || 0), 0);
  const totalReach = realPageMetrics.reduce((acc, p) => acc + (p.reach || 0), 0);
  const totalEngagement = realPageMetrics.reduce((acc, p) => acc + (p.engagement || 0), 0);
  const avgEngagement = realPageMetrics.length > 0 ? (totalEngagement / realPageMetrics.length).toFixed(2) : "0.00";

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-up px-6 lg:px-8 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-slate-800/50 skeleton"/>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-8">
           <div className="col-span-12 lg:col-span-8 h-[400px] bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 skeleton" />
           <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="h-48 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 skeleton" />
              <div className="h-48 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 skeleton" />
           </div>
        </div>
      </div>
    );
  }

  if (realPageMetrics.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-32 px-6 text-center animate-fade-up">
        <div className="relative mb-10">
          <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
          <div className="relative w-24 h-24 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-xl flex items-center justify-center text-indigo-500">
            <Layout size={40} strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Seu Dashboard está pronto.</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mb-10 text-lg leading-relaxed">
          Conecte suas contas do Facebook na aba <span className="text-indigo-600 dark:text-indigo-400 font-bold">Gateways</span> para visualizar o alcance da sua rede.
        </p>
        <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1 active:scale-95">
          Começar Configuração
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-up px-6 lg:px-8 pb-10">
      
      {/* GLOBAL METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Audiência Total', value: totalFans.toLocaleString(), icon: <Users size={20}/>, color: 'indigo', trend: '+12%' },
          { label: 'Alcance Mensal', value: totalReach.toLocaleString(), icon: <BarChart3 size={20}/>, color: 'emerald', trend: '+5.4%' },
          { label: 'Engajamento Médio', value: `${avgEngagement}%`, icon: <Heart size={20}/>, color: 'rose', trend: '+2.1%' },
          { label: 'Captura de Leads', value: 'Ativa', icon: <MousePointer2 size={20}/>, color: 'amber', trend: 'Live' }
        ].map((metric, i) => (
          <div key={i} className="group relative bg-white dark:bg-[#0f172a] p-7 rounded-[2rem] border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 overflow-hidden">
            <div className={`absolute -right-6 -bottom-6 w-32 h-32 bg-${metric.color}-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700`}></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div className={`p-3 bg-${metric.color}-50 dark:bg-${metric.color}-500/10 text-${metric.color}-600 dark:text-${metric.color}-400 rounded-2xl transition-colors group-hover:bg-${metric.color}-600 group-hover:text-white`}>
                  {metric.icon}
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-${metric.color}-500/10 text-${metric.color}-600 text-[10px] font-black uppercase tracking-wider`}>
                  <TrendingUp size={10} /> {metric.trend}
                </div>
              </div>
              
              <div>
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-1">{metric.label}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{metric.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* MAIN TABLE */}
        <div className="col-span-12 lg:col-span-8">
           <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-8 py-8 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
                      <Globe size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">Canais Conectados</h4>
                      <p className="text-sm font-medium text-slate-400 tracking-wide">Monitoramento de performance em tempo real</p>
                    </div>
                 </div>
                 <button className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline">
                    Ver Todos <ArrowUpRight size={16} />
                 </button>
              </div>
              
              <div className="overflow-x-auto flex-1">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-white/5 border-y border-slate-100 dark:border-slate-800/50">
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Canal</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Audiência</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">Alcance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {realPageMetrics.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-800 shrink-0">
                                 {p.picture ? (
                                   <img src={p.picture} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                                      {p.name?.charAt(0)}
                                   </div>
                                 )}
                               </div>
                               <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${p.health === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                                 <span className={`text-[10px] font-black uppercase tracking-widest ${p.health === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                   {p.health === 'healthy' ? 'Ativo' : 'Atenção'}
                                 </span>
                              </div>
                              {p.errorDetails && (
                                <span className="text-[10px] text-amber-500/80 max-w-[200px] truncate" title={p.errorDetails}>
                                  {p.errorDetails}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6 font-bold text-slate-900 dark:text-slate-100">{p.fans?.toLocaleString() || 0}</td>
                          <td className="px-8 py-6 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                             {p.engagement}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* SIDEBAR WIDGETS */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
           {/* STEALTH CARD */}
           <div className="group relative bg-[#0f172a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-700"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-3 bg-white/5 text-emerald-400 rounded-2xl border border-white/10">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocolo Stealth</span>
                    <span className="text-sm font-bold text-white">v8.0 Ativo</span>
                  </div>
                </div>
                
                <div className="space-y-4 mb-8">
                   <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <span>Integridade da Rede</span>
                      <span className="text-emerald-400">100%</span>
                   </div>
                   <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full w-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                   </div>
                </div>

                <div className="p-5 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Shadow Monitor</span>
                   </div>
                   <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                      Todas as automações estão operando sob o radar. Zero anomalias detectadas nas últimas 24h.
                   </p>
                </div>
              </div>
           </div>

           {/* QUICK STATS */}
           <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Zap size={20} />
                </div>
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Ações Pendentes</h4>
              </div>
              
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Automated Replies</span>
                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg">LIVE</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-slate-800/50 opacity-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bulk Scheduller</span>
                    <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg">IDLE</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
