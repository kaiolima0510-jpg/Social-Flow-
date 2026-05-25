
import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react';

interface SyncResult {
  successes: string[];
  errors: string[];
  totalImported: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInput: string;
  setTokenInput: (s: string) => void;
  onSync: () => Promise<SyncResult>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, tokenInput, setTokenInput, onSync }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Auto-close after success
  useEffect(() => {
    if (result && result.successes.length > 0 && result.errors.length === 0) {
      setCountdown(4);
    }
  }, [result]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      setCountdown(c => {
        if (c <= 1) { onClose(); setResult(null); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown, onClose]);

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!tokenInput.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await onSync();
      setResult(res);
      // If only errors, keep modal open so user can see them
      // If successes exist, auto-close countdown starts via useEffect
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCountdown(0);
    onClose();
  };

  const isValid = tokenInput.trim().length > 20;
  const hasSuccess = result && result.successes.length > 0;
  const hasErrors = result && result.errors.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-up">
      <div className="bg-white dark:bg-[#161b22] w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden border dark:border-[#30363d]"
           style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

        <div className="p-10">
          {/* Header */}
          <button onClick={handleClose} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
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

          {/* RESULT PANEL — shown after sync */}
          {result && (
            <div className={`mb-6 rounded-2xl overflow-hidden border-2 ${hasSuccess ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-rose-400 bg-rose-50 dark:bg-rose-500/10'}`}>
              <div className={`flex items-center gap-3 px-6 py-4 ${hasSuccess ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
                {hasSuccess ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}
                <span className="font-black text-sm uppercase tracking-widest">
                  {hasSuccess
                    ? `${result.totalImported} página(s) conectada(s)!${countdown > 0 ? ` Fechando em ${countdown}s...` : ''}`
                    : 'Não foi possível conectar nenhuma página'}
                </span>
              </div>
              <div className="px-6 py-4 space-y-2">
                {result.successes.map((s, i) => (
                  <p key={i} className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{s}</p>
                ))}
                {result.errors.map((e, i) => (
                  <p key={i} className="text-sm font-bold text-rose-700 dark:text-rose-400">{e}</p>
                ))}
              </div>
            </div>
          )}

          {/* Token input — hide after success */}
          {!hasSuccess && (
            <>
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
            </>
          )}

          {/* After success: button to add more */}
          {hasSuccess && (
            <button
              onClick={() => { setResult(null); setCountdown(0); }}
              className="w-full mt-2 py-4 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
            >
              + Adicionar mais tokens
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

