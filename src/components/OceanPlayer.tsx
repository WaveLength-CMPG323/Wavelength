import React from 'react';
import {
  Heart,
  ListMusic,
  Pause,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';

interface OceanPlayerProps{
    title: string;
    artist: string;
    albumArt: string;
}

export const OceanPlayer: React.FC<OceanPlayerProps> = ({
  title,
  artist,
  albumArt,
}) => {  
    return (
    <div className="flex h-full items-center justify-between gap-6 px-5 text-white">
      {/* Current track */}
      <div className="flex min-w-0 w-1/3 items-center gap-3">
        <img
          src={albumArt}
          alt="Current track album artwork"
          className="size-11 rounded-lg border border-cyan-300/20 object-cover shadow-lg"
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {title}
          </p>
          <p className="truncate text-xs text-slate-400">
            {artist}
          </p>
        </div>

        <button
          type="button"
          aria-label="Like current track"
          className="ml-2 text-slate-400 transition hover:text-cyan-300"
        >
          <Heart className="size-4" />
        </button>
      </div>

      {/* Playback controls */}
      <div className="flex w-1/3 flex-col items-center">
        <div className="flex items-center gap-5">
          <button
            type="button"
            aria-label="Shuffle"
            className="text-slate-400 transition hover:text-white"
          >
            <Shuffle className="size-4" />
          </button>

          <button
            type="button"
            aria-label="Previous track"
            className="text-slate-300 transition hover:text-white"
          >
            <SkipBack className="size-5" />
          </button>

          <button
            type="button"
            aria-label="Pause"
            className="flex size-9 items-center justify-center rounded-full bg-cyan-300 text-[#02111f] transition hover:scale-105"
          >
            <Pause className="size-4 fill-current" />
          </button>

          <button
            type="button"
            aria-label="Next track"
            className="text-slate-300 transition hover:text-white"
          >
            <SkipForward className="size-5" />
          </button>

          <button
            type="button"
            aria-label="Repeat"
            className="text-slate-400 transition hover:text-white"
          >
            <Repeat2 className="size-4" />
          </button>
        </div>

        <div className="mt-2 flex w-full max-w-sm items-center gap-3">
          <span className="text-[10px] text-slate-500">1:42</span>

          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[42%] rounded-full bg-cyan-300" />
          </div>

          <span className="text-[10px] text-slate-500">4:03</span>
        </div>
      </div>

      {/* Volume / queue */}
      <div className="flex w-1/3 items-center justify-end gap-4">
        <button
          type="button"
          aria-label="Open queue"
          className="text-slate-400 transition hover:text-white"
        >
          <ListMusic className="size-4" />
        </button>

        <Volume2 className="size-4 text-slate-400" />

        <div className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-cyan-300" />
        </div>
      </div>
    </div>
  );
};