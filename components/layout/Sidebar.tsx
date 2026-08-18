
import React from 'react';
import { Zap, Activity, Globe, Shield, ShieldCheck, Users, X, Menu, Terminal, Calendar } from 'lucide-react';
import { Tab } from '../../types';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  securityLogs: string[];
  postQueue: any[];
  isDarkMode: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const APP_VERSION = 'v8.0 Stealth';

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  securityLogs, 
  postQueue, 
  isDarkMode,
  isOpen,
  setIsOpen 
}) => {
  const activeQueueCount = postQueue.filter(i => i.status === 'pending' || i.status === 'processing').length;

  const role = typeof window !== 'undefined' ? sessionStorage.getItem('sf_role') : 'user';

  const NAV = [
    { tab: Tab.DASHBOARD,      icon: <Activity size={18}/>, label: 'Dashboard' },
    { tab: Tab.EDITOR_STEALTH, icon: <Zap size={18}/>,      label: 'Editor Stealth', badge: activeQueueCount },
    { tab: Tab.LEADS,          icon: <Users size={18}/>,    label: 'Leads' },
    { tab: Tab.GATEWAYS,       icon: <Globe size={18}/>,    label: 'Gateways' },
    { tab: Tab.SCHEDULED_POSTS, icon: <Calendar size={18}/>, label: 'Posts Agendados', badge: activeQueueCount },
  ];

  if (role === 'admin') {
    NAV.push({ tab: Tab.USERS, icon: <ShieldCheck size={18}/>, label: 'Gestão de Usuários' });
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        lg:relative lg:translate-x-0 lg:z-30
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-white dark:bg-[#0f172a] border-r border-slate-100 dark:border-slate-800/50
        flex flex-col py-8 px-6 overflow-y-auto custom-scrollbar
      `}>

        {/* Close button - Mobile only */}
        <button 
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Logo Section */}
        <div className="flex flex-col mb-12">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="relative">
              <div className="absolute -inset-1 bg-indigo-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative p-2.5 bg-indigo-600 rounded-xl text-white shadow-xl shadow-indigo-500/20">
                <Zap size={20} strokeWidth={2.5} className="animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white leading-none">SocialFlow</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500/80 mt-1.5">{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2 flex-1">
          <div className="px-3 mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Main Menu</span>
          </div>
          {NAV.map(({ tab, icon, label, badge }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-300
                  group relative overflow-hidden
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 translate-x-1' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:translate-x-1'
                  }
                `}
              >
                <span className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {icon}
                </span>
                <span className="flex-1 text-left">{label}</span>
                {badge != null && badge > 0 && (
                  <span className={`
                    min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px] font-black rounded-lg
                    ${isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}
                  `}>
                    {badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Security Nerve Center */}
        <div className="mt-8">
          <div className="relative group p-5 bg-slate-900 dark:bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 blur-3xl rounded-full group-hover:bg-indigo-500/20 transition-all duration-500"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-white text-[10px] font-black uppercase tracking-widest opacity-90">Stealth Engine</span>
                </div>
                <Terminal size={14} className="text-slate-500" />
              </div>
              
              <div className="space-y-2 max-h-32 overflow-hidden">
                {securityLogs.length > 0 ? (
                  securityLogs.slice(0, 4).map((log, i) => (
                    <div key={i} className="flex gap-2 group/log">
                      <span className="text-[9px] font-mono text-slate-600 mt-0.5 shrink-0">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                      <p className={`text-[9px] font-medium font-mono leading-relaxed line-clamp-2 transition-colors ${
                        log.includes('FAIL') || log.includes('ERR') ? 'text-rose-400' :
                        log.includes('WARN') ? 'text-amber-400' :
                        log.includes('OK') || log.includes('✓')  ? 'text-emerald-400' :
                        'text-slate-400'
                      }`}>
                        {log}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-4 flex flex-col items-center justify-center text-center">
                    <Shield size={24} className="text-slate-800 mb-2 opacity-50" />
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Aguardando Pulso...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Version Footer */}
          <div className="mt-6 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Active Stealth</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 opacity-50">#SF-80</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
