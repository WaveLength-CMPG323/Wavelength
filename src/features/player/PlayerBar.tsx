import { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Shuffle, Repeat } from 'lucide-react';
import Cover from '../../components/Cover';
import type { Song } from '../../data/types';

// Mock playback controls (adapted from the team's AudioPlayerBar). No audio
// is actually played -- the progress bar is a simulated timer. Wire this to
// the Spotify Web Playback SDK later; the handlers below are the seams.
const MOCK_DURATION = 210; // seconds, stand-in until real track duration exists

interface Props {
  queue: Song[];
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerBar({ queue }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(70);
  const [liked, setLiked] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const song = queue.length > 0 ? queue[index % queue.length] : null;

  // Reset progress whenever the track changes, and simulate playback.
  useEffect(() => { setElapsed(0); setLiked(false); }, [song?.id]);
  useEffect(() => {
    if (!playing || !song) return;
    const id = setInterval(() => {
      setElapsed((t) => (t >= MOCK_DURATION ? (repeat ? 0 : t) : t + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [playing, song?.id, repeat]);

  if (!song) return null;

  const skip = (delta: number) => {
    if (queue.length <= 1) return;
    setIndex((i) => {
      if (shuffled) return Math.floor(Math.random() * queue.length);
      return (i + delta + queue.length) % queue.length;
    });
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-between border-t border-cyan-500/20 bg-[#02182b]/95 px-4 text-white shadow-2xl backdrop-blur-lg md:px-8">
      {/* Currently Playing Track Metadata */}
      <div className="flex w-1/4 min-w-[180px] items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-cyan-500/30 bg-cyan-950">
          <Cover song={song} />
        </div>
        <div className="truncate">
          <p className="truncate text-sm font-semibold text-cyan-100">{song.title}</p>
          <p className="truncate text-xs text-slate-400">{song.artist}</p>
        </div>
        <button
          onClick={() => setLiked((l) => !l)}
          type="button"
          aria-label={liked ? 'Unlike' : 'Like'}
          className="ml-2 hidden text-slate-400 transition hover:text-cyan-300 sm:block"
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-cyan-400 text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Main Playback Controls & Scrubber */}
      <div className="flex w-2/4 max-w-md flex-col items-center gap-1.5">
        <div className="flex items-center gap-4 text-slate-300">
          <button
            onClick={() => setShuffled((s) => !s)}
            type="button"
            aria-label="Shuffle"
            className={`transition hover:text-cyan-300 ${shuffled ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button onClick={() => skip(-1)} type="button" aria-label="Previous track" className="hover:text-cyan-300 transition">
            <SkipBack className="h-4 w-4 fill-current" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300"
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
          <button onClick={() => skip(1)} type="button" aria-label="Next track" className="hover:text-cyan-300 transition">
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
          <button
            onClick={() => setRepeat((r) => !r)}
            type="button"
            aria-label="Repeat"
            className={`transition hover:text-cyan-300 ${repeat ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>

        <div className="flex w-full items-center gap-2 text-[10px] text-slate-400">
          <span>{formatTime(elapsed)}</span>
          <div className="group relative h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-cyan-950">
            <div
              className="h-full bg-cyan-400 transition-[width] group-hover:bg-cyan-300"
              style={{ width: `${Math.min(100, (elapsed / MOCK_DURATION) * 100)}%` }}
            />
          </div>
          <span>{formatTime(MOCK_DURATION)}</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex w-1/4 min-w-[120px] items-center justify-end gap-2 text-slate-400">
        <Volume2 className="h-4 w-4 text-cyan-400" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-cyan-950 accent-cyan-400"
        />
      </div>
    </footer>
  );
}
