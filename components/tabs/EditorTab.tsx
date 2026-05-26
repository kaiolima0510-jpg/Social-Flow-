
import React from 'react';
import { 
  Target, X, Layers, Sparkles, Zap, ImagePlus, Wand2, Calendar, FileSpreadsheet, UploadCloud, CheckCircle2, AlertTriangle, Loader2, Clock, Trash2, AlertCircle, Layout, ChevronRight, Wand
} from 'lucide-react';
import { FacebookAccount, PageGroup, PostType } from '../../types';
import Preview from '../Preview';

type PreviewMode = 'MANUAL' | 'BULK';


interface EditorTabProps {
  accounts: FacebookAccount[];
  selectedPageIds: Set<string>;
  setSelectedPageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  pageGroups: PageGroup[];
  handleSelectGroup: (g: PageGroup) => void;
  deletePageGroup: (id: string) => Promise<void>;
  useAI: boolean;
  setUseAI: (v: boolean) => void;
  manualData: {
    caption: string;
    comments: { text: string; delay: number }[];
    autoReplyText?: string;
    scheduledDate: string;
    storyLink: string;
    type: PostType;
    media: { id: string, preview: string, type: 'IMAGE' | 'VIDEO', description: string }[];
  };
  setManualData: React.Dispatch<React.SetStateAction<any>>;
  handleMagicFormat: () => void;
  handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAction: (isScheduled: boolean) => void;
  setIsScheduleModalOpen: (o: boolean) => void;
  isProcessing: boolean;
  sheetUrl: string;
  setSheetUrl: (s: string) => void;
  handleSyncSheet: () => void;
  isSyncingSheet: boolean;
  bulkFiles: Map<string, { file: File; preview: string }>;
  handleBulkFilesUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bulkType: PostType;
  setBulkType: (t: PostType) => void;
  handleRunBulk: () => void;
  enableRotation: boolean;
  setEnableRotation: (b: boolean) => void;
  sheetRows: any[];
  setSheetRows: (r: any[]) => void;
  setActiveTab: (tab: any) => void;
}

const EditorTab: React.FC<EditorTabProps> = ({
  accounts, selectedPageIds, setSelectedPageIds, pageGroups, handleSelectGroup, deletePageGroup,
  useAI, setUseAI, manualData, setManualData,
  handleMagicFormat, handleMediaUpload, handleAction, setIsScheduleModalOpen,
  isProcessing, sheetUrl, setSheetUrl, handleSyncSheet, isSyncingSheet,
  bulkFiles, handleBulkFilesUpload, bulkType, setBulkType, handleRunBulk,
  enableRotation, setEnableRotation,
  sheetRows, setSheetRows, setActiveTab
}) => {
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>('MANUAL');

  // Auto-switch to bulk when a sheet is loaded
  React.useEffect(() => {
    if (sheetRows && sheetRows.length > 0) {
      setPreviewMode('BULK');
    }
  }, [sheetRows]);

  const removeMediaItem = (id: string) => {

    setManualData((prev: any) => ({
      ...prev,
      media: prev.media.filter((m: any) => m.id !== id)
    }));
  };

  const updateMediaDescription = (id: string, text: string) => {
    setManualData((prev: any) => ({
      ...prev,
      media: prev.media.map((m: any) => m.id === id ? { ...m, description: text } : m)
    }));
  };

  const selectedGroup = pageGroups.find(g => 
    g.page_ids.length === selectedPageIds.size && g.page_ids.every(id => selectedPageIds.has(id))
  );
  const selectionLabel = selectedGroup?.name || (selectedPageIds.size > 0 ? `${selectedPageIds.size} páginas selecionadas` : null);

  const isSelectionEmpty = selectedPageIds.size === 0;
  const isCaptionEmpty = manualData.type !== 'STORY' && !manualData.caption.trim();
  const isMediaEmpty = manualData.type !== 'STORY' && manualData.media.length === 0;
  const isStoryLinkEmpty = manualData.type === 'STORY' && !manualData.storyLink.trim();
  
  const canPost = !isSelectionEmpty && !isCaptionEmpty && !isMediaEmpty && !isStoryLinkEmpty && !isProcessing;

  const getValidationMessage = () => {
    if (isSelectionEmpty) return 'Selecione as páginas de destino';
    if (isCaptionEmpty) return 'A legenda é obrigatória';
    if (isMediaEmpty) return 'Adicione pelo menos uma imagem/vídeo';
    if (isStoryLinkEmpty) return 'Insira o link para o Story';
    if (isProcessing) return 'Aguarde o processamento atual';
    return null;
  };

  const validationMsg = getValidationMessage();

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-6 lg:gap-12 animate-fade-up px-4 lg:px-12 pb-24">
      
      {/* LEFT COLUMN - EDITOR & BULK */}
      <div className="col-span-12 lg:col-span-7 space-y-10">
        
        {/* DESTINATION SELECTOR */}
        <div className="group bg-white dark:bg-[#0f172a] p-6 lg:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Target size={24} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1">Destino da Postagem</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {selectionLabel || 'Nenhum conjunto selecionado'}
                </h3>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('GATEWAYS')}
              className="flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
            >
              Gerenciar Páginas <ChevronRight size={14} />
            </button>
          </div>

          {pageGroups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pageGroups.map(g => {
                const isSelected = g.page_ids.length === selectedPageIds.size && g.page_ids.every(id => selectedPageIds.has(id));
                return (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGroup(g)}
                    className={`group/item relative p-5 rounded-[2rem] border-2 transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-500/5' 
                        : 'border-slate-50 dark:border-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 bg-slate-50/50 dark:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        isSelected ? 'bg-indigo-600 text-white rotate-6' : 'bg-white dark:bg-[#0f172a] text-slate-400 group-hover/item:text-indigo-600'
                      }`}>
                        <Layers size={22}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-black truncate mb-0.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>{g.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{g.page_ids.length} páginas</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePageGroup(g.id); }} 
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 dark:text-slate-700 dark:hover:text-rose-400 opacity-0 group-hover/item:opacity-100 transition-all"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEALTH POST ENGINE */}
        <div className="bg-white dark:bg-[#0f172a] p-6 lg:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32"></div>
          
          <div className="relative z-10 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute -inset-2 bg-indigo-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative p-4 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                    <Zap size={24} strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">Stealth Engine</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Configuração de Alta Performance</p>
                </div>
              </div>
              
              <button 
                onClick={() => setUseAI(!useAI)} 
                className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${
                  useAI 
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 shadow-lg shadow-amber-500/10' 
                    : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Sparkles size={16} className={useAI ? 'animate-pulse' : ''}/>
                AI Optimizer {useAI ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* 1. TYPE SELECTOR */}
            <div className="space-y-5">
               <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Tipo de Conteúdo
               </label>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {(['SINGLE', 'ALBUM', 'VIDEO', 'STORY'] as PostType[]).map(t => (
                   <button 
                     key={t} 
                     onClick={() => setManualData((p: any) => ({...p, type: t, media: []}))} 
                     className={`py-5 rounded-[1.75rem] border-2 text-[11px] font-black uppercase tracking-widest transition-all duration-500 active:scale-95 ${
                       manualData.type === t 
                         ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30' 
                         : 'border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-white/5 text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-500/30'
                     }`}
                   >
                     {t}
                   </button>
                 ))}
               </div>
            </div>

            {/* 2. CAPTION AREA */}
            {manualData.type !== 'STORY' && (
              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                   <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Legenda Criativa
                   </label>
                   <button 
                     onClick={handleMagicFormat} 
                     disabled={isProcessing || !manualData.caption} 
                     className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30 group"
                   >
                     <Wand size={14} className="inline-block mr-2 group-hover:rotate-12 transition-transform"/> Magic Format
                   </button>
                 </div>
                 <div className="relative">
                   <textarea 
                     value={manualData.caption} 
                     onFocus={() => setPreviewMode('MANUAL')}
                     onChange={e => setManualData((p: any) => ({...p, caption: e.target.value}))} 
                     className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-[2rem] p-8 h-48 resize-none font-bold text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-700 transition-all outline-none" 
                     placeholder="Escreva algo épico..." 
                   />
                   <div className="absolute bottom-6 right-8 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">
                     {manualData.caption.length} caracteres
                   </div>
                 </div>
              </div>
            )}

            {/* 3. MEDIA SECTION */}
            <div className="space-y-4">
               <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Assets Visuais
               </label>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {manualData.media.map((m: any) => (
                    <div key={m.id} className="relative group animate-fade-up">
                       <div className="aspect-[4/5] rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800/50 overflow-hidden relative shadow-lg">
                          {m.type === 'VIDEO' ? <video src={m.preview} className="w-full h-full object-cover" muted /> : <img src={m.preview} className="w-full h-full object-cover" alt="Media" />}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                             <button onClick={() => removeMediaItem(m.id)} className="w-12 h-12 bg-rose-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform"><Trash2 size={24}/></button>
                          </div>
                       </div>
                       <div className="mt-4">
                          <textarea 
                            value={m.description} 
                            onChange={(e) => updateMediaDescription(m.id, e.target.value)} 
                            placeholder="Legenda da imagem / Receita..." 
                            rows={4}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800/40 rounded-2xl px-5 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y" 
                          />
                       </div>
                    </div>
                  ))}
                  <label className={`
                    min-h-[300px] border-4 border-dashed border-slate-100 dark:border-slate-800/50 rounded-[2.5rem] 
                    flex flex-col items-center justify-center cursor-pointer 
                    hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all group
                    ${manualData.media.length > 0 ? 'aspect-[4/5]' : 'col-span-full py-16'}
                  `}>
                    <div className="flex flex-col items-center text-center px-10">
                      <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                        <ImagePlus size={36}/>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">Importar Mídia</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Arraste ou clique para selecionar</p>
                    </div>
                    <input type="file" className="hidden" onChange={handleMediaUpload} multiple={manualData.type === 'ALBUM'} accept="image/*,video/*" />
                  </label>
               </div>
            </div>

            {/* 4. STRATEGIC COMMENT */}
            {manualData.type === 'STORY' ? (
              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-4">
                   <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> CTA Link
                   </label>
                   <textarea 
                     value={manualData.storyLink} 
                     onChange={e => setManualData((p: any) => ({...p, storyLink: e.target.value}))} 
                     className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 focus:border-indigo-500 rounded-[2rem] p-6 font-bold text-slate-800 dark:text-slate-100 h-28 resize-none transition-all outline-none" 
                     placeholder="https://seulink.com/cta" 
                   />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Shadow Comments
                  </label>
                  <button 
                    onClick={() => setManualData((p: any) => ({ ...p, comments: [...p.comments, { text: "", delay: 0 }] }))}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                  >
                    + Adicionar Comentário
                  </button>
                </div>
                
                {manualData.comments?.map((c: any, index: number) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start relative group/comment">
                    <div className="md:col-span-8 space-y-2">
                       <textarea 
                         value={c.text} 
                         onChange={e => {
                           const newComments = [...manualData.comments];
                           newComments[index].text = e.target.value;
                           setManualData((p: any) => ({...p, comments: newComments}));
                         }} 
                         className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 focus:border-indigo-500 rounded-[2rem] p-6 font-bold text-slate-800 dark:text-slate-100 h-24 resize-none transition-all outline-none" 
                         placeholder={`Comentário ${index + 1}...`} 
                       />
                    </div>
                    <div className="md:col-span-4 space-y-2 relative">
                       <div className="relative group/delay">
                          <input 
                            type="number" 
                            min="0"
                            value={c.delay} 
                            onChange={e => {
                              const newComments = [...manualData.comments];
                              newComments[index].delay = parseInt(e.target.value) || 0;
                              setManualData((p: any) => ({...p, comments: newComments}));
                            }} 
                            className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 focus:border-indigo-500 rounded-[2rem] p-6 h-24 font-black text-3xl text-indigo-600 dark:text-indigo-400 text-center transition-all outline-none" 
                          />
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-slate-400 uppercase tracking-widest">
                             Minutos delay
                          </div>
                       </div>
                       {manualData.comments.length > 1 && (
                         <button 
                           onClick={() => {
                             const newComments = manualData.comments.filter((_: any, i: number) => i !== index);
                             setManualData((p: any) => ({...p, comments: newComments}));
                           }}
                           className="absolute -right-3 -top-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/comment:opacity-100 transition-opacity hover:scale-110 shadow-lg"
                         >
                           <X size={14}/>
                         </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. MESSENGER AUTO-REPLY */}
            {manualData.type !== 'STORY' && (
              <div className="space-y-4">
                 <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] flex items-center gap-2.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Auto-Reply Messenger (Opcional)
                 </label>
                 <textarea 
                   value={manualData.autoReplyText || ""} 
                   onChange={e => setManualData((p: any) => ({...p, autoReplyText: e.target.value}))} 
                   className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 focus:border-emerald-500 rounded-[2rem] p-6 font-bold text-slate-800 dark:text-slate-100 h-28 resize-none transition-all outline-none" 
                   placeholder="Ex: Aqui está o link da receita prometida: https://seusite.com/receita" 
                 />
                 <p className="text-[10px] font-bold text-slate-400">Essa mensagem será enviada no privado (inbox) para TODAS as pessoas que comentarem neste post.</p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-10">
              <div className="relative group">
                <button 
                  onClick={() => handleAction(false)} 
                  disabled={!canPost} 
                  className="w-full h-16 lg:h-20 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:translate-y-0"
                >
                  {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <><Zap size={22}/> Deploy Now</>}
                </button>
                {!canPost && validationMsg && (
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-2xl z-20">
                    ⚠️ {validationMsg}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45" />
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsScheduleModalOpen(true)} 
                disabled={!canPost} 
                className="w-full h-16 lg:h-20 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-4 hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <Calendar size={22}/> Schedule
              </button>
            </div>
          </div>
        </div>

        {/* BULK HUB */}
        <div className="bg-white dark:bg-[#0f172a] p-6 lg:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-white rounded-2xl">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">Bulk Hub</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Power Automation</p>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Source Sheet (CSV)</label>
                <div className="relative">
                  <input 
                    value={sheetUrl} 
                    onChange={e => setSheetUrl(e.target.value)} 
                    className="w-full bg-slate-50/50 dark:bg-white/5 border-2 border-slate-50 dark:border-slate-800/50 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100 transition-all outline-none focus:border-indigo-500" 
                    placeholder="https://docs.google.com/..." 
                  />
                  <button 
                    onClick={handleSyncSheet} 
                    disabled={isSyncingSheet} 
                    className="absolute right-2 top-2 bottom-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 rounded-xl text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSyncingSheet ? <Loader2 size={16} className="animate-spin"/> : 'Sync'}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">Local Assets</label>
                <label className="flex items-center gap-4 px-6 py-4 bg-indigo-50/30 dark:bg-indigo-500/5 border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-2xl cursor-pointer hover:bg-indigo-600 hover:text-white transition-all group">
                  <UploadCloud size={24} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0"/>
                  <span className="text-xs font-black uppercase tracking-widest">Upload Bulk Files</span>
                  <input type="file" multiple className="hidden" onChange={handleBulkFilesUpload} accept="image/*,video/*" />
                </label>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-slate-800/50 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">Rotação em Matriz</h4>
                <p className="text-[10px] font-bold text-slate-400">Distribui ciclicamente os posts a cada 10 páginas em vez de postar o mesmo post ao mesmo tempo.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={enableRotation} onChange={e => setEnableRotation(e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <button 
              onClick={handleRunBulk} 
              disabled={isProcessing || sheetRows.length === 0} 
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-xl hover:shadow-2xl transition-all disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-4"
            >
               <Zap size={20} fill="currentColor"/> Launch Bulk Operation
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - PREVIEW */}
      <div className="col-span-12 lg:col-span-5 relative">
         <div className="lg:sticky lg:top-12 animate-fade-left">
            <div className="relative group">
              {/* Decorative Frame Elements */}
              <div className="absolute -inset-10 bg-indigo-500/5 rounded-full blur-[120px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                 <div className="mb-8 px-6 py-2 bg-white dark:bg-[#0f172a] rounded-full border border-slate-100 dark:border-slate-800/50 shadow-sm flex items-center justify-between w-full max-w-[400px]">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Live Simulator</span>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                      <button
                        onClick={() => setPreviewMode('MANUAL')}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          previewMode === 'MANUAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        onClick={() => setPreviewMode('BULK')}
                        disabled={!sheetRows || sheetRows.length === 0}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          previewMode === 'BULK' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'
                        }`}
                      >
                        Bulk
                      </button>
                    </div>
                 </div>
                 
                 <div className="iphone-preview-container w-full max-w-[400px]">
                    <Preview 
                      pageName={selectionLabel || "SocialFlow Enterprise"} 
                      postState={{ 
                        mainCaption: previewMode === 'BULK' && sheetRows?.length > 0 
                          ? (sheetRows[0].caption || manualData.caption) 
                          : (manualData.caption || "Configure sua legenda para visualizar o preview..."), 
                        firstComment: previewMode === 'BULK' && sheetRows?.length > 0 
                          ? (sheetRows[0].comment || manualData.comments?.[0]?.text) 
                          : manualData.comments?.[0]?.text, 
                        images: previewMode === 'BULK' && sheetRows?.length > 0 && sheetRows[0].fileName && bulkFiles.has(sheetRows[0].fileName) 
                          ? [{ preview: bulkFiles.get(sheetRows[0].fileName)!.preview, type: bulkFiles.get(sheetRows[0].fileName)!.file.type.startsWith('video') ? 'VIDEO' : 'IMAGE' }] 
                          : (manualData.media || []), 
                        type: previewMode === 'BULK' ? bulkType : manualData.type, 
                        storyLink: manualData.storyLink || "" 
                      }} 
                    />
                 </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default EditorTab;
