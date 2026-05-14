
import React from 'react';
import { X, Layers, Loader2 } from 'lucide-react';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  newGroupName: string;
  setNewGroupName: (s: string) => void;
  selectedCount: number;
  onConfirm: () => void;
  isProcessing: boolean;
}

const GroupModal: React.FC<GroupModalProps> = ({
  isOpen, onClose, newGroupName, setNewGroupName, selectedCount, onConfirm, isProcessing
}) => {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newGroupName && !isProcessing) onConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-up">
      <div className="bg-white dark:bg-[#161b22] w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden border dark:border-[#30363d]">
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />

        <div className="p-10">
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={18}/>
          </button>

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-inner border border-emerald-100 dark:border-emerald-900/30">
              <Layers size={28}/>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Salvar Conjunto</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {selectedCount} página{selectedCount !== 1 ? 's' : ''} selecionada{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Conjunto</label>
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Páginas de Receitas"
                className="w-full input-modern dark:bg-[#0d1117] dark:border-[#30363d] dark:text-slate-200 px-5 py-4 font-bold text-slate-700"
                autoFocus
              />
            </div>

            {/* Preview badge */}
            {newGroupName && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 animate-fade-up">
                <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <Layers size={14} className="text-white"/>
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">{newGroupName}</p>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase">{selectedCount} páginas</p>
                </div>
              </div>
            )}

            <button
              onClick={onConfirm}
              disabled={!newGroupName || isProcessing}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing
                ? <><Loader2 size={18} className="animate-spin"/> Salvando...</>
                : <><Layers size={18}/> Confirmar e Salvar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupModal;
