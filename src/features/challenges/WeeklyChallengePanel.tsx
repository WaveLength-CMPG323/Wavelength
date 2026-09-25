import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Clock,
  Users,
  Waves,
  Gift,
  Sparkles,
  Search,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';

import NavPanel from '../../components/NavPanel';
import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import {
  formatCountdown,
  searchSpotifyCatalog,
  randomCover,
} from '../../data/mockData';
import type { CatalogEntry } from '../../data/types';

function mockParticipants(theme: string): number {
  let hash = 0;
  for (let i = 0; i < theme.length; i++) {
    hash = theme.charCodeAt(i) + ((hash << 5) - hash);
  }
  return 140 + (Math.abs(hash) % 220);
}

export default function WeeklyChallengePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, mutate } = useData();

  const [remaining, setRemaining] = useState(
    db.challenge.deadline - Date.now()
  );

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [pending, setPending] = useState<CatalogEntry | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [previewTab, setPreviewTab] = useState<'avatar' | 'track'>('avatar');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!open) return;

    const id = setInterval(() => {
      setRemaining(db.challenge.deadline - Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [open, db.challenge.deadline]);

  // Real-time 2D Canvas Water Caustics Engine
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = canvas.parentElement?.clientHeight || 900;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Light Caustic Rays from Surface
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const xOffset = Math.sin(time + i) * 30;
        const gradient = ctx.createLinearGradient(
          canvas.width * 0.2 + i * 80 + xOffset,
          0,
          canvas.width * 0.1 + i * 60,
          canvas.height
        );
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
        gradient.addColorStop(0.4, 'rgba(14, 165, 233, 0.08)');
        gradient.addColorStop(1, 'rgba(3, 7, 18, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.15 + i * 80 + xOffset, 0);
        ctx.lineTo(canvas.width * 0.35 + i * 80 + xOffset, 0);
        ctx.lineTo(canvas.width * 0.25 + i * 60, canvas.height);
        ctx.lineTo(canvas.width * 0.05 + i * 60, canvas.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  const alreadyEntered = !!db.challenge.mySubmission;
  const submittedSong = db.challenge.mySubmission
    ? db.songs[db.challenge.mySubmission.songId]
    : null;

  function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    setResults(searchSpotifyCatalog(value));
  }

  function submit() {
    if (!pending) return;

    const newId = `me-${Date.now()}`;

    mutate((data) => {
      data.songs[newId] = {
        id: newId,
        title: pending.title,
        artist: pending.artist,
        cover: randomCover(pending.title + pending.artist),
        ownerId: 'me',
      };

      data.floaterOrder.push(newId);

      data.challenge.mySubmission = {
        songId: newId,
      };
    });

    setQuery('');
    setResults([]);
    setPending(null);
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
      {/* DEEP OCEAN WATER COLUMN GRADIENT (Light surface at top -> Abyssal darkness at seabed) */}
      <div className="relative min-h-full overflow-hidden bg-gradient-to-b from-[#0e3a5a] via-[#061e38] to-[#020914] px-6 py-6 font-sans text-slate-100 antialiased selection:bg-cyan-500/30">
        
        {/* REAL-TIME 2D WATER CAUSTICS & LIGHT RAYS CANVAS */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80"
        />

        {/* TOP SURFACE LIGHT REFRACTION SHIMMER */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-300/20 via-sky-400/10 to-transparent blur-md z-0" />

        {/* MULTI-LAYERED BLURRED SUNKEN TREASURE CHESTS IN DEEP WATER BACKGROUND */}
        
        {/* Chest 1: Upper-Mid Depth (Medium Blur) */}
        <div className="pointer-events-none absolute -left-10 top-24 z-0 rotate-[-18deg] opacity-40 blur-[3px]">
          <div className="relative h-20 w-28 rounded-xl border border-amber-300/30 bg-gradient-to-b from-amber-700/60 via-amber-950/80 to-[#0c0602] p-2 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <div className="h-3 w-full rounded-sm bg-amber-400/50" />
            <div className="mt-3 flex justify-center">
              <div className="h-3 w-3 rounded-full border border-amber-300/80 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
            </div>
          </div>
        </div>

        {/* Chest 2: Mid Seabed Depth (Deep Blur) */}
        <div className="pointer-events-none absolute -right-12 top-1/2 z-0 rotate-[15deg] opacity-30 blur-[6px]">
          <div className="relative h-24 w-32 rounded-xl border border-amber-400/20 bg-gradient-to-b from-amber-800/50 via-amber-950/90 to-black p-2.5 shadow-[0_0_35px_rgba(245,158,11,0.2)]">
            <div className="h-4 w-full rounded-sm bg-amber-400/40" />
          </div>
        </div>

        {/* Chest 3: Bottom Seabed Floor (Near Primary Chest Aura - Heavy Blur) */}
        <div className="pointer-events-none absolute left-12 bottom-8 z-0 rotate-[8deg] opacity-25 blur-[8px]">
          <div className="relative h-16 w-24 rounded-lg border border-yellow-500/20 bg-gradient-to-b from-yellow-800/40 to-black p-2 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
            <div className="h-2.5 w-full rounded-sm bg-amber-400/30" />
          </div>
        </div>

        {/* PRIMARY OPENED TREASURE CHEST GOLDEN RADIANCE BEHIND MODAL */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-0 h-96 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-amber-500/25 via-amber-400/15 to-transparent blur-[110px] animate-pulse" />

        {/* BIOLUMINESCENT UNDERWATER BUBBLE PARTICLES */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: '-10%', opacity: [0, 0.6, 0] }}
              transition={{
                duration: 7 + i * 2,
                repeat: Infinity,
                delay: i * 0.9,
                ease: 'easeInOut',
              }}
              style={{ left: `${i * 15}%` }}
              className="absolute h-1.5 w-1.5 rounded-full bg-cyan-200/40 shadow-[0_0_8px_#38bdf8]"
            />
          ))}
        </div>

        {/* FOREGROUND MODAL CONTENT LAYERS */}
        <div className="relative z-10 space-y-5">

          {/* SECTION 1: HERO / THEME CARD (APPLE iOS LIQUID GLASS WITH SPECULAR EDGE) */}
          <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 via-white/[0.04] to-transparent p-6 shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            {/* Liquid Specular Top Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              {/* Challenge Pill Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <Trophy className="h-3.5 w-3.5 text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                <span className="text-xs font-semibold text-amber-100">
                  This Week's Challenge
                </span>
              </div>

              {/* Hydro Clock Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 backdrop-blur-md">
                <Clock className="h-3.5 w-3.5 text-cyan-300" />
                <span className="font-mono text-xs font-medium text-slate-200">
                  {remaining > 0 ? formatCountdown(remaining) : 'Closed'}
                </span>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/90">
              Weekly Theme
            </p>

            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
              {db.challenge.theme}
            </h2>

            <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-300/90">
              Share a track that captures this week's theme. Choose the song that best represents your interpretation and submit it before the timer runs out.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-200">
                <Users className="h-3.5 w-3.5 text-cyan-400" />
                <span>{mockParticipants(db.challenge.theme)} joined</span>
              </div>

              {alreadyEntered && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Joined ✓</span>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: CHALLENGE RULES */}
          <section className="rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-3">
              <Waves className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Challenge Rules
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-slate-300/80">
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                Submit one song that fits this week's challenge theme.
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                Only one entry is allowed per person each week.
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                Your submitted song will appear in the Ocean.
              </li>
            </ul>
          </section>

          {/* SECTION 3: WEEKLY REWARD SHOWCASE & PREVIEW TOGGLE */}
          <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 via-black/30 to-black/50 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  <Gift className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/90">
                    Weekly Reward
                  </p>
                  <h3 className="text-sm font-bold text-white">
                    Abyssal Radiance Frame
                  </h3>
                </div>
              </div>

              {/* Preview Mode Switcher */}
              <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('avatar')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    previewTab === 'avatar'
                      ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Avatar Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('track')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    previewTab === 'track'
                      ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Track Cover
                </button>
              </div>
            </div>

            {/* Reward Live Preview Card */}
            <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {previewTab === 'avatar' ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {/* Animated Gold/Cyan Bio-Glow Frame */}
                    <div className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-amber-400 via-cyan-400 to-amber-300 opacity-80 blur-sm animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-900 shadow-xl">
                      <span className="text-lg font-bold text-white">YOU</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                      <Sparkles className="h-3 w-3" /> Profile Cosmetic
                    </span>
                    <p className="text-xs font-semibold text-white mt-0.5">
                      Abyssal Sunken Aura
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Unlocks upon challenge submission.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 opacity-75 blur-md" />
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/30 shadow-2xl">
                      {submittedSong ? (
                        <Cover song={submittedSong} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-400">
                          <Lock className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300">
                      <Sparkles className="h-3 w-3" /> Ocean Marker Effect
                    </span>
                    <p className="text-xs font-semibold text-white mt-0.5">
                      Hydro-Ripple Beacon
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Applied to your entry floating in the sea.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 4: SONG SEARCH & ENTRY SUBMISSION */}
          <section className="relative">
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
                Your Entry
              </p>
              <h3 className="text-sm font-bold text-white">Choose your song</h3>
            </div>

            <div className="relative">
              <div
                className={`flex items-center gap-3 rounded-xl border px-3.5 transition-all duration-200 ${
                  isSearchFocused
                    ? 'border-cyan-400/80 bg-black/60 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  disabled={alreadyEntered}
                  value={query}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => handleQuery(e.target.value)}
                  placeholder="Search songs or artists..."
                  className="w-full bg-transparent py-3 text-xs text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setResults([]);
                      setPending(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* SEARCH RESULTS DROPDOWN */}
              {results.length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#071325]/95 shadow-2xl backdrop-blur-2xl">
                  {results.map((song) => (
                    <button
                      key={`${song.title}-${song.artist}`}
                      onClick={() => {
                        setPending(song);
                        setQuery(`${song.title} — ${song.artist}`);
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left text-xs text-white transition last:border-none hover:bg-white/10"
                      type="button"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10">
                        <Cover song={song} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-200">{song.title}</p>
                        <p className="truncate text-[11px] text-slate-400">{song.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SUBMIT BUTTON */}
            {pending && !alreadyEntered && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={submit}
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:brightness-110"
                type="button"
              >
                <span>Confirm & Submit Entry</span>
              </motion.button>
            )}

            {alreadyEntered && (
              <div className="mt-3.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-center text-xs font-bold text-emerald-300">
                Challenge entry submitted ✓
              </div>
            )}

            <p className="mt-2.5 text-center text-[10px] font-medium text-slate-400/80">
              Limited to one entry per week.
            </p>
          </section>

        </div>
      </div>
    </NavPanel>
  );
}