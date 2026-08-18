import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
  isDarkMode: boolean;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, isDarkMode }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('Por favor, insira a senha mestre.');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.token) {
          sessionStorage.setItem('sf_session_token', data.token);
        }
        if (data.workspace) {
          sessionStorage.setItem('sf_workspace', data.workspace);
        }
        onLoginSuccess();
      } else {
        setError(data.error || 'Senha incorreta.');
        setPassword('');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDarkMode ? 'bg-[#020617]' : 'bg-[#F8FAFC]'}`}>
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative w-full max-w-md p-8">
        
        {/* Card Container */}
        <div className={`relative backdrop-blur-xl rounded-3xl border shadow-2xl p-8 sm:p-10 transition-all duration-300
          ${isDarkMode 
            ? 'bg-slate-900/50 border-slate-700/50 shadow-black/50' 
            : 'bg-white/70 border-white shadow-indigo-900/5'}`}
        >
          
          {/* Logo/Icon */}
          <div className="flex justify-center mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30`}>
              <Zap size={32} className="drop-shadow-md" />
            </div>
          </div>
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className={`text-3xl font-black mb-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Social Flow
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Acesso restrito. Insira a senha mestre para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className={`text-xs font-bold uppercase tracking-wider ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                Senha Mestre
              </label>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`w-full pl-11 pr-4 py-3.5 rounded-xl text-sm transition-all duration-300 outline-none
                    ${isDarkMode 
                      ? 'bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20' 
                      : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                    }`}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <div className="w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-300
                ${isLoading 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0'
                }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Acessar Plataforma
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Ambiente Seguro</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
