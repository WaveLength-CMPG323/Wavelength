import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  Users,
  Search,
  X,
  CheckCircle2,
  Lock,
  Compass,
  Check,
  Power,
  Sparkles,
  Eye,
  Disc,
  User,
  AlertTriangle,
  Database,
  ShieldAlert,
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

export interface CosmeticRelic {
  id: string;
  name: string;
  description: string;
  challengeTheme: string;
  unlocked: boolean;
}

const COSMETIC_RELICS: CosmeticRelic[] = [
  {
    id: 'abyssal-crest',
    name: 'Abyssal Crest',
    description: 'Bioluminescent cyan glow applied to your avatar aura and your floating ocean song marker.',
    challengeTheme: 'NOSTALGIA',
    unlocked: true,
  },
  {
    id: 'golden-tide',
    name: 'Golden Tide',
    description: 'Radiant golden shimmer applied to your avatar aura and your floating ocean song marker.',
    challengeTheme: 'GOLDEN HOUR',
    unlocked: true,
  },
  {
    id: 'coral-bloom',
    name: 'Coral Bloom',
    description: 'Ethereal pink pulse applied to your avatar aura and your floating ocean song marker.',
    challengeTheme: 'SUMMER DRIFT',
    unlocked: false,
  },
];

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

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setRemaining(db.challenge.deadline - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [open, db.challenge.deadline]);

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

  function toggleRelic(relic: CosmeticRelic) {
    if (!relic.unlocked) return;

    mutate((data) => {
      const currentActive = data.user?.activeCosmeticEffect;
      data.user = {
        ...data.user,
        activeCosmeticEffect: currentActive === relic.id ? null : relic.id,
      };
    });
  }

  const activeEffect = db.user?.activeCosmeticEffect;

  return (
    <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
      <div className="relative min-h-full overflow-hidden bg-gradient-to-b from-[#0e3a5a] via-[#061e38] to-[#020914] px-6 py-6 font-sans text-slate-100 antialiased selection:bg-cyan-500/30">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-cyan-300/20 via-sky-400/10 to-transparent blur-md" />

        <div className="relative z-10 space-y-6">
          {/* 1. HERO / THEME CARD */}
          <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 via-white/[0.04] to-transparent p-6 shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            {/* VISUAL BACKEND COMMENT: ACTIVE CHALLENGE DATA */}
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur-sm">
              <Database className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>[BACKEND REQUIRED: Dynamic active challenge payload (Theme, Expiry Timestamp, and Participant Count)]</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <Trophy className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs font-semibold text-amber-100">
                  This Week's Challenge
                </span>
              </div>

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

            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
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
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Joined ✓</span>
                </div>
              )}
            </div>
          </section>

          {/* 2. SONG SEARCH & ENTRY */}
          <section className="relative">
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
                Your Entry
              </p>
              <h3 className="text-sm font-bold text-white">Choose your song</h3>
            </div>

            {/* VISUAL BACKEND COMMENT: SONG SEARCH & GENRE VALIDATION */}
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>[BACKEND REQUIRED: Real Spotify API catalog search proxy endpoint]</span>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur-sm">
                <ShieldAlert className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>[BACKEND REQUIRED: Automatic genre matching validation against the challenge theme before entry confirmation]</span>
              </div>
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
                      className="flex w-full items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-left text-xs text-white transition hover:bg-white/10"
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

            {pending && !alreadyEntered && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={submit}
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                type="button"
              >
                <span>Confirm & Submit Entry</span>
              </motion.button>
            )}

            {alreadyEntered && (
              <div className="mt-3.5 flex flex-col items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-center text-xs font-bold text-emerald-300">
                <span>Challenge entry submitted ✓</span>
                <span className="text-[10px] text-emerald-200/80 font-normal">
                  [BACKEND REQUIRED: Persist user submission to ocean map DB]
                </span>
              </div>
            )}
          </section>

          {/* 3. LIVE REWARD PREVIEW */}
          <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-cyan-300" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Live Reward Preview
                </h3>
              </div>

              <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('avatar')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    previewTab === 'avatar'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="h-3 w-3" />
                  <span>Avatar Aura</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('track')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    previewTab === 'track'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Disc className="h-3 w-3" />
                  <span>Song Marker</span>
                </button>
              </div>
            </div>

            <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/50 p-4">
              <div className="relative flex items-center justify-center">
                {activeEffect === 'abyssal-crest' && (
                  <>
                    <div className="absolute -inset-4 animate-pulse rounded-full bg-gradient-to-tr from-cyan-400 via-sky-300 to-teal-300 opacity-70 blur-lg" />
                    <div className="absolute -inset-2 animate-ping rounded-full border border-cyan-400/40 opacity-40" />
                  </>
                )}

                {activeEffect === 'golden-tide' && (
                  <>
                    <div className="absolute -inset-4 animate-pulse rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 opacity-80 blur-lg" />
                    <div className="absolute -inset-2 animate-ping rounded-full border border-amber-400/40 opacity-40" />
                  </>
                )}

                {previewTab === 'avatar' ? (
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-300 bg-slate-900 shadow-xl overflow-hidden z-10">
                    {db.me.pic ? (
                      <img
                        src={db.me.pic}
                        alt="Preview Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-amber-500 text-slate-950 font-bold">
                        <User className="h-10 w-10 text-white" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400/80 bg-slate-950/90 shadow-2xl z-10">
                    {db.challenge.mySubmission ? (
                      <div className="h-full w-full rounded-full overflow-hidden p-1">
                        <Cover song={db.songs[db.challenge.mySubmission.songId]} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-cyan-300">
                        <Disc className="h-8 w-8 animate-spin" />
                        <span className="text-[9px] font-bold tracking-wider mt-0.5">NODE</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4. UNLOCKED COSMETICS */}
          <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2.5 mb-1">
              <Compass className="h-4 w-4 text-cyan-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Unlocked Cosmetics
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Toggle effects on or off. Equipping a cosmetic applies the effect to both your profile avatar and your ocean song marker.
            </p>

            {/* VISUAL BACKEND COMMENT: USER COSMETICS STATE */}
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur-sm">
              <Database className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>[BACKEND REQUIRED: User unlocked cosmetics inventory state & active effect equip endpoint]</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {COSMETIC_RELICS.map((relic) => {
                const isActive = activeEffect === relic.id;

                return (
                  <div
                    key={relic.id}
                    className={`relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 ${
                      !relic.unlocked
                        ? 'border-white/5 bg-black/40 opacity-50'
                        : isActive
                        ? 'border-cyan-400/50 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-black/40 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                        : 'border-white/10 bg-black/30 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            isActive
                              ? 'border-cyan-300 bg-cyan-400/20 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                              : 'border-white/10 bg-white/5 text-slate-400'
                          }`}
                        >
                          {relic.unlocked ? (
                            <Sparkles className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4 text-slate-500" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-xs font-bold text-white">
                              {relic.name}
                            </p>
                            <span className="rounded bg-cyan-400/10 border border-cyan-400/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300 uppercase">
                              Profile & Ocean
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-300/80">
                            {relic.description}
                          </p>
                          <p className="mt-0.5 text-[9px] font-medium text-amber-400/80">
                            Challenge Reward: {relic.challengeTheme}
                          </p>
                        </div>
                      </div>

                      <div>
                        {relic.unlocked ? (
                          <button
                            type="button"
                            onClick={() => toggleRelic(relic)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all ${
                              isActive
                                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            {isActive ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-cyan-300" />
                                <span>Equipped</span>
                              </>
                            ) : (
                              <>
                                <Power className="h-3.5 w-3.5" />
                                <span>Unequipped</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 px-2 py-1">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </NavPanel>
  );
}