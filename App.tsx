
import React from 'react';
import { Tab } from './types';
import { useSocialFlow } from './hooks/useSocialFlow';

// Layout
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

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
    manualData, setManualData, handleMagicFormat, handleMediaUpload, handleAction,
    postQueue, removeFromQueue, clearCompletedFromQueue,
    togglePageSelection, handleSelectGroup, handleCreateGroup, deletePageGroup,
    reSyncAccount,
    addSecurityLog

  } = useSocialFlow();

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
        <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <ErrorBoundary>
            {activeTab === Tab.DASHBOARD && (
              <DashboardTab 
                realPageMetrics={realPageMetrics} 
                stealthStats={stealthStats} 
                isProcessing={isProcessing}
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
    </div>
  );
};

export default App;
