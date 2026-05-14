
import React from 'react';
import { ThumbsUp, MessageCircle, Share2, Globe, MoreHorizontal, Link, X, Heart, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';

interface PreviewProps {
  postState: {
    mainCaption: string;
    firstComment: string;
    images: { preview: string, description?: string, type?: 'IMAGE' | 'VIDEO' }[];
    type?: 'ALBUM' | 'SINGLE' | 'VIDEO' | 'STORY';
    storyLink?: string;
  };
  pageName: string;
}

const Preview: React.FC<PreviewProps> = ({ postState, pageName }) => {
  const { images, mainCaption, firstComment, type, storyLink } = postState;
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
  const currentDay = new Date().getDate();

  const isStory = type === 'STORY';
  const isAlbum = type === 'ALBUM';

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const renderMedia = (media: { preview: string, type?: 'IMAGE' | 'VIDEO' }, className: string) => {
    if (media.type === 'VIDEO') {
      return (
        <video 
          src={media.preview} 
          className={className} 
          autoPlay 
          muted 
          loop 
          playsInline
        />
      );
    }
    return <img src={media.preview} className={className} alt="Preview" />;
  };

  if (isStory) {
    return (
      <div className="iphone-frame bg-black w-[320px] h-[640px] mx-auto border-[#1a1a1a] border-[12px] rounded-[3.5rem] shadow-2xl relative overflow-hidden animate-fade-up">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1a1a1a] rounded-b-2xl z-30"></div>
        
        {/* Story Background */}
        <div className="absolute inset-0 z-0 bg-slate-900">
          {images.length > 0 ? (
            renderMedia(images[0], "w-full h-full object-cover")
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-700 font-black uppercase tracking-[0.2em] gap-6 p-12 text-center">
               <div className="w-16 h-16 rounded-[2rem] border-2 border-dashed border-slate-800 animate-spin" />
               Awaiting Visual Assets
            </div>
          )}
        </div>

        {/* Story Progress Bar */}
        <div className="absolute top-10 left-4 right-4 flex gap-1 z-20">
           <div className="h-1 flex-1 bg-white rounded-full"></div>
           <div className="h-1 flex-1 bg-white/30 rounded-full"></div>
           <div className="h-1 flex-1 bg-white/30 rounded-full"></div>
        </div>

        {/* Story Header */}
        <div className="absolute top-14 left-4 right-4 flex items-center justify-between z-20">
          <div className="flex gap-3 items-center">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black border-2 border-white/20 shadow-xl">
              {pageName.charAt(0)}
            </div>
            <div>
              <h3 className="font-black text-[12px] text-white drop-shadow-lg">{pageName}</h3>
              <span className="text-[10px] text-white/70 font-bold">{currentDay} {currentMonth} • Sponsored</span>
            </div>
          </div>
          <div className="flex gap-4">
            <MoreHorizontal size={20} className="text-white drop-shadow-lg" />
            <X size={20} className="text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Story Interaction Link Area */}
        {storyLink && (
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-3 z-20">
            <div className="px-6 py-2.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl transition-all hover:scale-105">
              <Link size={14} /> Learn More
            </div>
            <div className="w-1 h-6 bg-gradient-to-b from-white/60 to-transparent rounded-full animate-bounce"></div>
          </div>
        )}

        {/* Story Footer */}
        <div className="absolute bottom-8 left-4 right-4 flex items-center gap-4 z-20">
          <div className="flex-1 px-5 py-3.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-white/60 text-[11px] font-bold">
            Send message...
          </div>
          <Heart size={26} className="text-white drop-shadow-lg" />
          <Share2 size={26} className="text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="iphone-frame bg-white dark:bg-[#0f172a] w-[320px] h-[640px] mx-auto border-[#1a1a1a] border-[12px] rounded-[3.5rem] shadow-2xl relative overflow-hidden animate-fade-up">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1a1a1a] rounded-b-2xl z-30"></div>
      
      <div className="h-full overflow-y-auto custom-scrollbar pt-8">
        {/* Post Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[12px] font-black shadow-lg">
              {pageName.charAt(0)}
            </div>
            <div>
              <h3 className="font-black text-[13px] text-slate-900 dark:text-white leading-tight">{pageName}</h3>
              <div className="flex items-center text-[10px] text-slate-400 font-bold gap-1.5 uppercase tracking-widest mt-0.5">
                <span>{currentDay} {currentMonth}</span> • <Globe size={10} />
              </div>
            </div>
          </div>
          <MoreHorizontal size={18} className="text-slate-400" />
        </div>

        {/* Post Caption */}
        <div className="px-4 pb-4 text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
          {mainCaption || "Compose your legacy here..."}
        </div>

        {/* Post Media Container */}
        <div className="relative bg-slate-50 dark:bg-black/20 aspect-square overflow-hidden border-y border-slate-100 dark:border-white/5 flex items-center justify-center group">
          {images.length > 0 ? (
            <>
              {renderMedia(images[currentImageIndex], "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105")}
              
              {/* Overlay Indicators */}
              {images.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full font-black z-10">
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button onClick={prevImage} className="p-2 bg-white/90 dark:bg-black/80 rounded-full shadow-xl pointer-events-auto hover:scale-110 transition-transform">
                    <ChevronLeft size={20} className="text-slate-800 dark:text-white" />
                  </button>
                  <button onClick={nextImage} className="p-2 bg-white/90 dark:bg-black/80 rounded-full shadow-xl pointer-events-auto hover:scale-110 transition-transform">
                    <ChevronRight size={20} className="text-slate-800 dark:text-white" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 p-12 text-center opacity-20">
               <ImageIcon size={48} strokeWidth={1} />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Media Selected</p>
            </div>
          )}
        </div>

        {/* Interaction Bar */}
        <div className="px-4 py-4 flex justify-between items-center text-slate-400 dark:text-slate-500">
          <div className="flex gap-5">
            <ThumbsUp size={22} className="hover:text-indigo-500 transition-colors cursor-pointer" />
            <MessageCircle size={22} className="hover:text-indigo-500 transition-colors cursor-pointer" />
            <Share2 size={22} className="hover:text-indigo-500 transition-colors cursor-pointer" />
          </div>
          <Bookmark size={22} className="hover:text-indigo-500 transition-colors cursor-pointer" />
        </div>

        {/* Social Proof Area */}
        <div className="px-4 py-2 border-t border-slate-50 dark:border-white/5">
           <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">
             Liked by <span className="font-black">Naju Araújo</span> and <span className="font-black">12,402 others</span>
           </p>
        </div>

        {/* Auto-Comment Integration */}
        {firstComment && (
          <div className="mx-4 mt-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group/comment animate-fade-up">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-md shrink-0">
                {pageName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[12px] font-black text-slate-900 dark:text-white truncate">{pageName}</span>
                   <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                   <span className="text-[10px] font-bold text-indigo-500 uppercase">Author</span>
                </div>
                <p className="text-[12px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed whitespace-pre-wrap">{firstComment}</p>
                <div className="flex items-center gap-4 mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <span className="hover:text-indigo-500 cursor-pointer">Reply</span>
                   <span className="hover:text-indigo-500 cursor-pointer">Share</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="h-24" /> {/* Bottom Padding */}
      </div>
    </div>
  );
};

// Help with missing icon
const ImageIcon = ({ size, strokeWidth }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

export default Preview;
