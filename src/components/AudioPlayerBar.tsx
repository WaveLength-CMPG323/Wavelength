import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Shuffle, Repeat } from 'lucide-react';

export const AudioPlayerBar: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#02182b]/95 backdrop-blur-lg border-t border-cyan-500/20 px-4 md:px-8 flex items-center justify-between z-50 text-white shadow-2xl">
      
      {/* Currently Playing Track Metadata */}
      <div className="flex items-center gap-3 w-1/4 min-w-[180px]">
        <div className="w-12 h-12 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-xs text-cyan-300 font-bold shrink-0">
          WAVE
        </div>
        <div className="truncate">
          <p className="text-sm font-semibold text-cyan-100 truncate">Midnight Trench</p>
          <p className="text-xs text-slate-400 truncate">Deep Wave</p>
        </div>
        <button className="text-slate-400 hover:text-cyan-300 transition ml-2 hidden sm:block">
          <Heart className="w-4 h-4" />
        </button>
      </div>

      {/* Main Playback Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-md">
        <div className="flex items-center gap-4 text-slate-300">
          <button className="hover:text-cyan-300 transition text-slate-400">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="hover:text-cyan-300 transition">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:bg-cyan-300 transition shadow-lg shadow-cyan-400/20"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button className="hover:text-cyan-300 transition">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
          <button className="hover:text-cyan-300 transition text-slate-400">
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Track Progress Bar */}
        <div className="w-full flex items-center gap-2 text-[10px] text-slate-400">
          <span>1:24</span>
          <div className="flex-1 h-1 bg-cyan-950 rounded-full overflow-hidden cursor-pointer relative group">
            <div className="w-1/3 h-full bg-cyan-400 group-hover:bg-cyan-300 transition"></div>
          </div>
          <span>3:45</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex items-center justify-end gap-2 w-1/4 text-slate-400 min-w-[120px]">
        <Volume2 className="w-4 h-4 text-cyan-400" />
        <div className="w-20 h-1 bg-cyan-950 rounded-full overflow-hidden cursor-pointer">
          <div className="w-3/4 h-full bg-cyan-400"></div>
        </div>
      </div>

    </footer>
  );
};
