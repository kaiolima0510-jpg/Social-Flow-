
import React, { useMemo } from 'react';
import { ShieldCheck, ScanEye, Activity, Clock, ArrowUpRight, RotateCcw, Terminal, Shield, Zap, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { updateScheduledCommentStatus } from '../../services/supabaseService';

interface SecurityTabProps {
  stealthStats: { integrity: number };
  securityLogs: string[];
  robotLogs: any[];
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  failed:    'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]',
  pending:   'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
  processing:'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]',
};

const logColor = (log: string) => {
  if (log.includes('FAIL') || log.includes('ERR'))  return 'text-rose-400';
  if (log.includes('WARN'))                          return 'text-amber-400';
  if (log.includes('OK') || log.includes('✓'))       return 'text-emerald-400';
  if (log.includes('CMT'))                           return 'text-sky-400';
  if (log.includes('IA'))                            return 'text-violet-400';
  if (log.includes('QUEUE'))                         return 'text-indigo-400';
  return 'text-slate-400';
};

const SecurityTab: React.FC<SecurityTabProps> = ({ stealthStats, securityLogs, robotLogs, onRefresh }) => {
  const logsWithTime = useMemo(() => {
    const now = Date.now();
    return securityLogs.map((log, i) => ({
      log,
      time: new Date(now - i * 2200).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));
  }, [securityLogs.length]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-up px-6 lg:px-12 pb-24">
      
      {/* SECURITY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Proteção Stealth', value: 'ATIVO', icon: <ShieldCheck size={24}/>, color: 'emerald', sub: 'Monitoramento v8.0', progress: 100 },
          { label: 'Rede Integrity', value: `${stealthStats.integrity}%`, icon: <ScanEye size={24}/>, color: 'indigo', sub: 'Confiança da Infra', progress: stealthStats.integrity },
          { label: 'Eventos Monitorados', value: securityLogs.length.toString(), icon: <Activity size={24}/>, color: 'amber', sub: 'Últimas 24 horas', progress: 100 }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden group">
            <div className={`absolute -right-6 -bottom-6 w-32 h-32 bg-${card.color}-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700`}></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3.5 bg-${card.color}-50 dark:bg-${card.color}-500/10 text-${card.color}-600 dark:text-${card.color}-400 rounded-2xl`}>
                  {card.icon}
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{card.label}</h3>
              </div>
              
              <div className="mb-6">
                <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{card.value}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{card.sub}</p>
              </div>

              <div className="h-2 w-full bg-slate-50 dark:bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-${card.color}-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)] ${card.color === 'emerald' ? 'animate-pulse' : ''}`} 
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN SECURITY CONSOLE */}
      <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-2 bg-slate-900 dark:bg-indigo-500/20 rounded-2xl blur opacity-20"></div>
              <div className="relative p-4 bg-slate-900 dark:bg-white text-emerald-400 dark:text-slate-900 rounded-2xl shadow-xl">
                <Terminal size={24} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2 uppercase">Security Command Center</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Live Infrastructure Monitoring</p>
            </div>
          </div>
          
          <button
            onClick={onRefresh}
            className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={16}/> Resync Core
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* LEFT: SCHEDULED QUEUE */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2">
                <Clock size={14}/> Active Queue ({robotLogs.length})
              </p>
            </div>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
              {robotLogs.length === 0 ? (
                <div className="py-24 text-center bg-slate-50/50 dark:bg-white/5 rounded-[2.5rem] border-4 border-dashed border-slate-100 dark:border-slate-800/50">
                  <div className="w-16 h-16 bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <Clock size={32} strokeWidth={1} />
                  </div>
                  <p className="text-xs font-black uppercase text-slate-300 dark:text-slate-600 tracking-widest">No scheduled events</p>
                </div>
              ) : (
                robotLogs.map((log, i) => (
                  <div key={i} className={`
                    group p-6 rounded-[2rem] border-2 transition-all duration-300
                    ${log.status === 'completed' ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-500/20' :
                      log.status === 'failed'    ? 'bg-rose-50/30 dark:bg-rose-500/5 border-rose-500/20' :
                      'bg-white dark:bg-[#0f172a] border-slate-50 dark:border-slate-800/50 hover:border-indigo-500/30'
                    }
                  `}>
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full ${statusColors[log.status] || 'bg-slate-400'}`}></div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{log.status}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">
                        {new Date(log.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400">
                          <Zap size={14}/>
                        </div>
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300">ID: {log.fb_post_id?.slice(-8)}</p>
                      </div>
                      <a
                        href={`https://facebook.com/${log.fb_post_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline flex items-center gap-1"
                      >
                        Source <ArrowUpRight size={12}/>
                      </a>
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-slate-800/50 mb-4">
                       <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic line-clamp-2 leading-relaxed">
                         "{log.comment_text}"
                       </p>
                    </div>

                    {log.last_error && (
                      <div className="flex items-center gap-2 p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 mb-4 animate-shake">
                        <AlertTriangle size={12} className="text-rose-500 shrink-0"/>
                        <p className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 truncate">ERR: {log.last_error}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
                      <div className="flex items-center gap-2">
                         <RotateCcw size={10} className="text-slate-300"/>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retry {log.attempts}/10</span>
                      </div>
                      {log.status !== 'completed' && (
                        <button
                          onClick={async () => { await updateScheduledCommentStatus(log.id, 'pending', undefined, 0); onRefresh(); }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                        >
                          Force Deploy
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: LIVE LOG CONSOLE */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2">
                <Activity size={14}/> Stealth Integrity Log ({securityLogs.length})
              </p>
            </div>
            
            <div className="bg-[#0f172a] dark:bg-black rounded-[2.5rem] p-10 h-[600px] overflow-hidden relative shadow-2xl border border-slate-800/50 flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-4">
                {logsWithTime.length > 0 ? (
                  logsWithTime.map((entry, i) => (
                    <div key={i} className="flex gap-5 items-start group animate-fade-in">
                      <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${logColor(entry.log).replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`}></div>
                        <div className="w-px h-full min-h-[20px] bg-slate-800 opacity-20"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-3 mb-1">
                            <span className="text-[9px] font-mono text-slate-600 uppercase font-black">{entry.time}</span>
                            <div className="h-px flex-1 bg-slate-800/50"></div>
                         </div>
                         <p className={`text-[12px] font-mono leading-relaxed ${logColor(entry.log)} break-words font-bold`}>
                           {entry.log}
                         </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                       <Activity size={32} className="text-slate-500 animate-pulse" />
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase">System idle. Listening for events...</p>
                  </div>
                )}
              </div>
              
              {/* Scanline Effect Overlay */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-20 bg-[length:100%_4px,3px_100%]"></div>
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black to-transparent z-10 opacity-50"></div>
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent z-10 opacity-50"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;
