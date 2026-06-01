
import React from 'react';
import { Tab } from './types';
import { useSocialFlow } from './hooks/useSocialFlow';
import { Activity, Zap, Users, Globe, Shield } from 'lucide-react';

// Layout
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ScheduledPostsTab from './components/tabs/ScheduledPostsTab';

// Tabs
import DashboardTab from './components/tabs/DashboardTab';
import EditorTab from './components/tabs/EditorTab';
import GatewaysTab from './components/tabs/GatewaysTab';
import SecurityTab from './components/tabs/SecurityTab';
import LeadsTab from './components/tabs/LeadsTab';

// Modals
import ImportModal from './components/modals/ImportModal';
import GroupModal from './components/modals/GroupModal';
import ScheduleModal from './components/modals/ScheduleModal';
import ErrorBoundary from './components/ErrorBoundary';
import QueuePanel from './components/QueuePanel';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const {
    activeTab, setActiveTab,
    isDarkMode, toggleDarkMode,
    accounts, loadAccounts, deleteAccount,

    isImportModalOpen, setIsImportModalOpen,
    isProcessing, progress,
    tokenInput, setTokenInput, syncTokens,
    useAI, setUseAI,
    realPageMetrics,
    securityLogs,
    robotLogs,
    stealthStats,
    selectedPageIds, setSelectedPageIds,
    pageGroups,
    newGroupName, setNewGroupName,
    isGroupModalOpen, setIsGroupModalOpen,
    isScheduleModalOpen, setIsScheduleModalOpen,
    pageSearch, setPageSearch,
    sheetUrl, setSheetUrl,
    sheetRows, setSheetRows,
    bulkFiles, handleBulkFilesUpload,
    isSyncingSheet, handleSyncSheet,
    bulkType, setBulkType, handleRunBulk,
    enableRotation, setEnableRotation,
    manualData, setManualData, handleMagicFormat, handleMediaUpload, handleAction,
    postQueue, removeFromQueue, clearCompletedFromQueue,
    togglePageSelection, handleSelectGroup, handleCreateGroup, deletePageGroup,
    reSyncAccount,
    addSecurityLog

  } = useSocialFlow();

  const activeQueueCount = postQueue.filter(
    (i: any) => i.status === 'pending' || i.status === 'processing'
  ).length;

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-[#020617]' : 'bg-[#F8FAFC]'} transition-colors duration-300 overflow-hidden font-sans`}>
      
      {/* ELITE SIDEBAR */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        securityLogs={securityLogs}
        postQueue={postQueue}
        isDarkMode={isDarkMode}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* MAIN VIEWPORT */}
      <main className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-[#020617]' : 'bg-[#F8FAFC]'}`}>
        
        {/* ELITE HEADER (Unified for Desktop/Mobile) */}
        <Header 
          activeTab={activeTab} 
          isProcessing={isProcessing} 
          progress={progress} 
          onRefresh={loadAccounts}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* CONTENT HUB */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-10 pb-24 lg:pb-10 custom-scrollbar">
          <ErrorBoundary>
            {activeTab === Tab.DASHBOARD && (
              <DashboardTab 
                realPageMetrics={realPageMetrics} 
                stealthStats={stealthStats} 
                isProcessing={isProcessing}
                robotLogs={robotLogs}
              />
            )}

            {activeTab === Tab.EDITOR_STEALTH && (
              <EditorTab 
                accounts={accounts}
                selectedPageIds={selectedPageIds}
                setSelectedPageIds={setSelectedPageIds}
                pageGroups={pageGroups}
                handleSelectGroup={handleSelectGroup}
                useAI={useAI}
                setUseAI={setUseAI}
                manualData={manualData}
                setManualData={setManualData}
                handleMagicFormat={handleMagicFormat}
                handleMediaUpload={handleMediaUpload}
                handleAction={handleAction}
                setIsScheduleModalOpen={setIsScheduleModalOpen}
                isProcessing={isProcessing}
                sheetUrl={sheetUrl}
                setSheetUrl={setSheetUrl}
                handleSyncSheet={handleSyncSheet}
                isSyncingSheet={isSyncingSheet}
                bulkFiles={bulkFiles}
                handleBulkFilesUpload={handleBulkFilesUpload}
                bulkType={bulkType}
                setBulkType={setBulkType}
                handleRunBulk={handleRunBulk}
                sheetRows={sheetRows}
                setSheetRows={setSheetRows}
                setActiveTab={setActiveTab}
                deletePageGroup={deletePageGroup}
                enableRotation={enableRotation}
                setEnableRotation={setEnableRotation}
              />
            )}

            {activeTab === Tab.GATEWAYS && (
              <GatewaysTab 
                accounts={accounts} 
                setIsImportModalOpen={setIsImportModalOpen} 
                onDisconnect={deleteAccount} 
                selectedPageIds={selectedPageIds}
                setSelectedPageIds={setSelectedPageIds}
                pageSearch={pageSearch}
                setPageSearch={setPageSearch}
                pageGroups={pageGroups}
                handleSelectGroup={handleSelectGroup}
                deletePageGroup={deletePageGroup}
                togglePageSelection={togglePageSelection}
                setIsGroupModalOpen={setIsGroupModalOpen}
                reSyncAccount={reSyncAccount}
              />
            )}

            {activeTab === Tab.LEADS && (
              <LeadsTab 
                accounts={accounts}
                isDarkMode={isDarkMode}
                addSecurityLog={addSecurityLog}
              />
            )}

            {activeTab === Tab.SCHEDULED_POSTS && (
              <ScheduledPostsTab activeTab={activeTab} setActiveTab={setActiveTab} />
            )}

            {activeTab === Tab.SEGURANCA && (
              <SecurityTab 
                stealthStats={stealthStats} 
                securityLogs={securityLogs} 
                robotLogs={robotLogs} 
                onRefresh={loadAccounts} 
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* MODAL LAYER */}
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        tokenInput={tokenInput} 
        setTokenInput={setTokenInput} 
        onSync={syncTokens} 
      />

      <GroupModal 
        isOpen={isGroupModalOpen} 
        onClose={() => setIsGroupModalOpen(false)} 
        newGroupName={newGroupName} 
        setNewGroupName={setNewGroupName} 
        selectedCount={selectedPageIds.size} 
        onConfirm={handleCreateGroup} 
        isProcessing={isProcessing} 
      />

      <ScheduleModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
        scheduledDate={manualData.scheduledDate} 
        setScheduledDate={(s) => setManualData((p: any) => ({...p, scheduledDate: s}))} 
        onConfirm={() => { handleAction(true); setIsScheduleModalOpen(false); }} 
        isProcessing={isProcessing} 
      />

      <QueuePanel
        postQueue={postQueue}
        removeFromQueue={removeFromQueue}
        clearCompletedFromQueue={clearCompletedFromQueue}
      />

      {/* ===== MOBILE BOTTOM NAVIGATION ===== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800/50 shadow-2xl shadow-black/5">
        <div className="flex items-stretch h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {([
            { tab: Tab.DASHBOARD,      Icon: Activity, label: 'Hub' },
            { tab: Tab.EDITOR_STEALTH, Icon: Zap,      label: 'Editor' },
            { tab: Tab.LEADS,          Icon: Users,    label: 'Leads' },
            { tab: Tab.GATEWAYS,       Icon: Globe,    label: 'Gateways' },
            { tab: Tab.SEGURANCA,      Icon: Shield,   label: 'Segurança' },
          ] as { tab: Tab; Icon: React.ElementType; label: string }[]).map(({ tab, Icon, label }) => {
            const isActive = activeTab === tab;
            const badge = tab === Tab.EDITOR_STEALTH ? activeQueueCount : 0;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all duration-200 active:scale-90 select-none ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-b-full" />
                )}
                {badge > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-[16px] h-4 flex items-center justify-center px-1 text-[8px] font-black bg-rose-500 text-white rounded-full leading-none">
                    {badge}
                  </span>
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                />
                <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default App;
