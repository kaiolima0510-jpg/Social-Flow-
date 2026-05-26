
import React from 'react';
import { RefreshCw, Loader2, Sun, Moon, Menu, Bell, Zap, Search } from 'lucide-react';
import { Tab } from '../../types';

interface HeaderProps {
  activeTab: Tab;
  isProcessing: boolean;
  progress: { current: number; total: number };
  onRefresh: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onMenuClick?: () => void;
}

const tabLabels: Record<Tab, string> = {
  [Tab.DASHBOARD]: 'Intelligence Hub',
  [Tab.EDITOR_STEALTH]: 'Stealth Post Engine',
  [Tab.GATEWAYS]: 'Gateway Manager',
  [Tab.SEGURANCA]: 'Security Command Center',
  [Tab.LEADS]: 'Leads Hub',
};

const Header: React.FC<HeaderProps> = ({ 
  activeTab, isProcessing, progress, onRefresh, isDarkMode, toggleDarkMode, onMenuClick 
}) => {
  return (
    <header className="h-16 lg:h-20 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/50 px-4 lg:px-10 flex items-center justify-between sticky top-0 z-40 transition-all duration-300">
      
      {/* LEFT: TAB TITLE & MOBILE MENU */}
      <div className="flex items-center gap-6">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
          <div>
             <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
               {tabLabels[activeTab] || activeTab}
             </h2>
             <p className="hidden lg:block text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-0.5">
                SocialFlow Enterprise v8.0
             </p>
          </div>
        </div>
      </div>

      {/* RIGHT: GLOBAL ACTIONS */}
      <div className="flex items-center gap-2 lg:gap-4">
        
        {/* Status indicator for processing */}
        {isProcessing ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 animate-pulse-slow">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
              Processing {progress.current}/{progress.total}
            </span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[9px] font-black uppercase tracking-widest">System Ready</span>
          </div>
        )}

        <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-2 hidden lg:block"></div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={onRefresh} 
            className="p-3 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 rounded-2xl transition-all group"
            title="Sincronizar dados"
          >
            <RefreshCw size={18} className={`${isProcessing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
          </button>

          <button
            onClick={toggleDarkMode}
            className="p-3 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/20 rounded-2xl transition-all"
            title="Alternar tema"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative group">
             <button className="p-3 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 rounded-2xl transition-all">
                <Bell size={18} />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-[#0d1117] rounded-full"></span>
             </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
