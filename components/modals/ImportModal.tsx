
import React, { useState } from 'react';
import { X, Key, ExternalLink, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInput: string;
  setTokenInput: (s: string) => void;
  onSync: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, tokenInput, setTokenInput, onSync }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!tokenInput.trim()) return;
    setIsLoading(true);
    try {
      await onSync();
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = tokenInput.trim().length > 20;

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-up">
      <div className="bg-white dark:bg-[#161b22] w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden border dark:border-[#30363d]"
           style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

        <div className="p-10">
          {/* Header */}
          <button onClick={onClose} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <X size={20}/>
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="p-3.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Key size={24}/>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Conectar Perfil</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cole seu token de acesso do Facebook</p>
            </div>
          </div>

          {/* Token input */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Token de Acesso</label>
              {isValid && (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                  <CheckCircle2 size={12}/> Formato válido
                </span>
              )}
            </div>
            <textarea
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="EAAxxxxxxxx..."
              className="w-full input-modern dark:bg-[#0d1117] dark:border-[#30363d] dark:text-slate-200 p-5 h-44 font-mono text-[11px] leading-relaxed resize-none"
              autoFocus
            />
            <p className="text-[10px] font-bold text-slate-400">
              ⚡ Cole um ou mais tokens, um por linha, para importar múltiplos perfis de uma vez.
            </p>
          </div>

          {/* How to guide — collapsible */}
          <div className="mb-8 bg-indigo-50/60 dark:bg-indigo-900/10 rounded-2xl overflow-hidden border border-indigo-100 dark:border-indigo-900/30">
            <button
              onClick={() => setShowGuide(g => !g)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-indigo-500"/>
                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">Como obter seu token?</span>
              </div>
              {showGuide ? <ChevronDown size={16} className="text-indigo-400"/> : <ChevronRight size={16} className="text-indigo-400"/>}
            </button>
            {showGuide && (
              <div className="px-6 pb-5 space-y-3 border-t border-indigo-100 dark:border-indigo-900/30">
                <ol className="space-y-2 mt-3">
                  {[
                    'Acesse o Facebook Developers (developers.facebook.com)',
                    'Crie um App ou acesse um existente com permissões de página',
                    'Vá em "Graph API Explorer" e gere um token com: pages_show_list, pages_manage_posts, pages_read_engagement',
                    'Copie o token gerado e cole no campo acima',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[9px] font-black mt-0.5">{i+1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                >
                  <ExternalLink size={12}/> Abrir Graph API Explorer
                </a>
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleSync}
            disabled={isLoading || !isValid}
            className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin"/> Verificando e conectando...</>
            ) : (
              <><Key size={18}/> Verificar e Conectar Perfil</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
