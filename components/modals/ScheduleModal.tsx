
import React from 'react';
import { X, Calendar, Clock, Zap, AlertCircle } from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledDate: string;
  setScheduledDate: (s: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

// Quick-pick presets
const PRESETS = [
  { label: '+30 min',  minutes: 30 },
  { label: '+1h',      minutes: 60 },
  { label: '+3h',      minutes: 180 },
  { label: 'Amanhã',   minutes: 1440 },
];

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen, onClose, scheduledDate, setScheduledDate, onConfirm, isProcessing
}) => {
  if (!isOpen) return null;

  const applyPreset = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60000);
    // Format for datetime-local: YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, '0');
    const str = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setScheduledDate(str);
  };

  const parsedDate = scheduledDate ? new Date(scheduledDate) : null;
  const isInPast = parsedDate ? parsedDate <= new Date() : false;
  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-up">
      <div className="bg-white dark:bg-[#161b22] w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden border dark:border-[#30363d]">
        {/* Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 to-violet-500" />

        <div className="p-10">
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={18}/>
          </button>

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-900/30">
              <Calendar size={28}/>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Agendar Publicação</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Escolha quando publicar</p>
          </div>

          <div className="space-y-6">
            {/* Quick presets */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Atalhos Rápidos</label>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.minutes)}
                    className="py-2.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30 transition-all uppercase tracking-wide"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date/time input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Clock size={12}/> Data e Hora Exata
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full input-modern dark:bg-[#0d1117] dark:border-[#30363d] dark:text-slate-200 px-5 py-4 font-bold text-slate-700"
              />
            </div>

            {/* Validation warning */}
            {isInPast && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 animate-fade-up">
                <AlertCircle size={16} className="text-amber-500 shrink-0"/>
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">A data selecionada está no passado!</p>
              </div>
            )}

            {/* Confirmation display */}
            {parsedDate && !isInPast && (
              <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-fade-up">
                <Zap size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0"/>
                <div>
                  <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">Agendado para:</p>
                  <p className="text-[11px] font-black text-indigo-800 dark:text-indigo-200">
                    {parsedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    {' · '}{parsedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={onConfirm}
              disabled={!scheduledDate || isProcessing || isInPast}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <Calendar size={18}/> Confirmar Agendamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
