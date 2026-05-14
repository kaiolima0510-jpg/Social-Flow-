
import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, X, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, 
  Clock, ListOrdered, Bell, Trash2, Zap, Activity
} from 'lucide-react';
import { QueueItem } from '../types';

interface QueuePanelProps {
  postQueue: QueueItem[];
  removeFromQueue: (id: string) => void;
  clearCompletedFromQueue: () => void;
}

const statusConfig = {
  pending:    { label: 'Pending', color: 'text-slate-400',  bg: 'bg-slate-100 dark:bg-white/5',   icon: <Clock size={12}/> },
  processing: { label: 'Deploying', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', icon: <Loader2 size={12} className="animate-spin"/> },
  done:       { label: 'Success',  color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-500/10',  icon: <CheckCircle2 size={12}/> },
  error:      { label: 'Failed',       color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-50 dark:bg-rose-500/10',     icon: <AlertCircle size={12}/> },
};

const logColor = (log: string) => {
  if (log.includes('FAIL') || log.includes('ERR')) return 'text-rose-400';
  if (log.includes('OK') || log.includes('✓'))     return 'text-emerald-400';
  if (log.includes('CMT'))                          return 'text-sky-400';
  return 'text-slate-500';
};

const QueuePanel: React.FC<QueuePanelProps> = ({ postQueue, removeFromQueue, clearCompletedFromQueue }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  const prevProcessingCount = useRef(0);

  useEffect(() => {
    const processingNow = postQueue.filter(i => i.status === 'processing').length;
    const pendingNow    = postQueue.filter(i => i.status === 'pending').length;
    const wasProcessing = prevProcessingCount.current > 0;

    if (wasProcessing && processingNow === 0 && pendingNow === 0 && postQueue.length > 0) {
      setJustFinished(true);
      setTimeout(() => setJustFinished(false), 4000);
    }
    prevProcessingCount.current = processingNow;
  }, [postQueue]);

  if (postQueue.length === 0) return null;

  const processing = postQueue.filter(i => i.status === 'processing');
  const pending    = postQueue.filter(i => i.status === 'pending');
  const done       = postQueue.filter(i => i.status === 'done' || i.status === 'error');
  const hasCompleted = done.length > 0;
  const allDone = postQueue.every(i => i.status === 'done' || i.status === 'error');

  return (
    <div className={`
      fixed bottom-8 right-8 z-[100] w-[400px] rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.5)] 
      overflow-hidden border border-white/20 dark:border-white/10 transition-all duration-700 animate-fade-left
    `}
    style={{ maxHeight: isOpen ? '650px' : '72px' }}>

      {/* HEADER SECTION */}
      <div
        className={`
          flex items-center justify-between px-6 py-5 cursor-pointer select-none transition-all duration-700
          ${justFinished
            ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
            : 'bg-gradient-to-br from-indigo-900 to-[#020617]'
          }
        `}
        onClick={() => setIsOpen(o => !o)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${justFinished ? 'bg-white/20 scale-110 rotate-12' : 'bg-white/10'}`}>
            {justFinished ? <Bell size={20} className="text-white animate-bounce"/> : <Activity size={20} className="text-indigo-400"/>}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-white/50 tracking-[0.2em] leading-none mb-1.5">
              {justFinished ? 'Mission Accomplished' : 'Nerve Center / Queue'}
            </p>
            <div className="flex items-center gap-3">
              {processing.length > 0 ? (
                <span className="flex items-center gap-2 text-xs font-black text-white">
                  <Loader2 size={12} className="animate-spin text-indigo-400"/> Deploying {processing.length} items
                </span>
              ) : allDone ? (
                 <span className="text-xs font-black text-emerald-400 flex items-center gap-2">
                   <CheckCircle2 size={12}/> All Systems Clear
                 </span>
              ) : (
                <span className="text-xs font-black text-white/80">{pending.length + processing.length} active tasks</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasCompleted && (
            <button
              onClick={e => { e.stopPropagation(); clearCompletedFromQueue(); }}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-rose-500 text-white/40 hover:text-white rounded-xl transition-all"
              title="Clear completed"
            >
              <Trash2 size={16}/>
            </button>
          )}
          <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-white/30">
            {isOpen ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      {isOpen && (
        <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl divide-y divide-slate-100 dark:divide-white/5 overflow-y-auto custom-scrollbar"
             style={{ maxHeight: '578px' }}>
          {postQueue.map(item => {
            const cfg = statusConfig[item.status];
            const isExp = expandedId === item.id;
            const pct = item.progress.total > 0
              ? Math.round((item.progress.current / item.progress.total) * 100)
              : 0;

            return (
              <div key={item.id} className={`p-6 transition-all duration-300 ${isExp ? 'bg-indigo-50/20 dark:bg-indigo-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                {/* Item header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <span className={cfg.color}>{cfg.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-900 dark:text-white truncate leading-tight mb-1.5">{item.label}</p>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.pages.length} targets</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.logs.length > 0 && (
                      <button 
                        onClick={() => setExpandedId(isExp ? null : item.id)} 
                        className={`p-2 rounded-lg transition-all ${isExp ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                      >
                        {isExp ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    )}
                    {item.status !== 'processing' && (
                      <button onClick={() => removeFromQueue(item.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all">
                        <X size={16}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Processing visualizer */}
                {item.status === 'processing' && (
                  <div className="mt-5 space-y-3">
                    <div className="flex justify-between items-end px-1">
                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Global Progress</p>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{pct}%</p>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
                       {item.progress.current} of {item.progress.total} operations completed
                    </p>
                  </div>
                )}

                {/* Expanded logs console */}
                {isExp && item.logs.length > 0 && (
                  <div className="mt-5 bg-[#0d1117] dark:bg-black rounded-2xl p-5 border border-slate-200 dark:border-white/10 relative overflow-hidden group/console shadow-inner">
                    <div className="absolute top-3 right-4 flex gap-1.5 opacity-30">
                       <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                       <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                       <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    </div>
                    
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2 relative z-10">
                      {item.logs.map((log, i) => (
                        <div key={i} className="flex gap-3">
                           <span className="text-[9px] font-mono text-slate-700 shrink-0 select-none">[{i+1}]</span>
                           <p className={`text-[10px] font-mono leading-relaxed ${logColor(log)} break-words font-bold`}>
                             {log}
                           </p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Console Scanline */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-20 -top-20 group-hover/console:animate-scanline"></div>
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

export default QueuePanel;
