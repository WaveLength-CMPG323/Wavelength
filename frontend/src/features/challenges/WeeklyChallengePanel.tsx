import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  Users,
  X,
  CheckCircle2,
  Sparkles,
  Palette,
  ListMusic,
  Plus,
  Eye,
} from 'lucide-react';

import Cover from '../../components/Cover';
import { useAuth } from '../../data/AuthContext';
import { formatCountdown } from '../../data/mockData';
import {
  fetchActiveChallenge,
  fetchChallengeEntries,
  fetchCosmeticsInventory,
  equipCosmetic,
} from '../../lib/api';
import { getSocket } from '../../lib/socket';
import JoinChallengeModal from './JoinChallengeModal';
import BorderPickerModal from './BorderPickerModal';
import BorderFrame from '../../components/BorderFrame';
import RewardPreviewModal from './RewardPreviewModal';
import type { ActiveChallenge, ChallengeEntry, CosmeticItem } from '../../data/types';

// "5m ago" / "3h ago" / "2d ago" for the entries list.
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatEnd(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Unlike the other overlays (Notifications, Create Group), Weekly
// Challenges gets its own large, top-of-viewport presentation rather than
// the shared NavPanel's centered modal - the user explicitly wants this
// panel emphasized: big, anchored near the top-middle of the Ocean page,
// well clear of the floating song bubbles beneath it, and responsive down
// to phone width.
//
// Layout: the challenge (name, description, live countdown, Join button),
// a compact "profile border" row that opens a dropdown picker, and the
// list of everyone's entries. Joining happens in its own sub-panel
// (JoinChallengeModal) - the song search lives only there.
export default function WeeklyChallengePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();

  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState('');

  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>([]);
  const [equipping, setEquipping] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [borderOpen, setBorderOpen] = useState(false);
  const [rewardPreviewOpen, setRewardPreviewOpen] = useState(false);
  // Joining also tries to start the track playing on Spotify (so it shows
  // up in the ocean) - that can fail independently of the entry itself (no
  // Premium, no active device). Not an error, so it gets a calmer notice.
  const [playbackNotice, setPlaybackNotice] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const challengeIdRef = useRef<string | number | null>(null);

  const loadChallenge = useCallback(async () => {
    try {
      const active = await fetchActiveChallenge();
      setChallenge(active);
    } catch (err) {
      console.error('Could not load active challenge:', err instanceof Error ? err.message : err);
    }
  }, []);

  const loadEntries = useCallback(async (challengeId: string | number) => {
    try {
      const list = await fetchChallengeEntries(challengeId);
      // Ignore a response for a challenge that's no longer the one shown.
      if (challengeIdRef.current === challengeId) {
        setEntries(list);
        setEntriesError('');
      }
    } catch (err) {
      if (challengeIdRef.current === challengeId) {
        setEntriesError(err instanceof Error ? err.message : 'Could not load entries');
      }
    } finally {
      if (challengeIdRef.current === challengeId) setEntriesLoading(false);
    }
  }, []);

  // Load the active challenge + the caller's cosmetics whenever the panel opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setJoinOpen(false);
    setBorderOpen(false);
    setRewardPreviewOpen(false);
    setLoadingChallenge(true);
    fetchActiveChallenge()
      .then((active) => {
        if (!cancelled) setChallenge(active);
      })
      .catch((err) => console.error('Could not load active challenge:', err.message))
      .finally(() => {
        if (!cancelled) setLoadingChallenge(false);
      });

    fetchCosmeticsInventory()
      .then((items) => {
        if (!cancelled) setCosmetics(items);
      })
      .catch((err) => console.error('Could not load cosmetics inventory:', err.message));

    return () => {
      cancelled = true;
    };
  }, [open]);

  // A different challenge than before (the weekly rollover): everyone starts
  // un-joined, so drop the old entries/notice/sub-panels and load the new list.
  const challengeId = challenge?.id ?? null;
  useEffect(() => {
    challengeIdRef.current = challengeId;
    setPlaybackNotice('');
    setJoinOpen(false);
    setRewardPreviewOpen(false);
    setEntries([]);
    setEntriesError('');
    if (!open || challengeId === null) return;
    setEntriesLoading(true);
    void loadEntries(challengeId);
  }, [challengeId, open, loadEntries]);

  // Live updates while open: someone joined (new count + entries list), or
  // the backend rolled over to the next challenge.
  useEffect(() => {
    if (!open) return;
    const socket = getSocket();

    function onChallengeUpdate(payload: { challengeId: string | number; participantCount: number }) {
      setChallenge((current) => {
        if (!current || String(current.id) !== String(payload.challengeId)) return current;
        return { ...current, participantCount: payload.participantCount };
      });
      const shownId = challengeIdRef.current;
      if (shownId !== null && String(shownId) === String(payload.challengeId)) {
        void loadEntries(shownId);
      }
    }
    function onChallengeRotated() {
      void loadChallenge();
    }

    socket.on('challenge:update', onChallengeUpdate);
    socket.on('challenge:rotated', onChallengeRotated);
    return () => {
      socket.off('challenge:update', onChallengeUpdate);
      socket.off('challenge:rotated', onChallengeRotated);
    };
  }, [open, loadEntries, loadChallenge]);

  // Countdown clock.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const deadlineMs = challenge ? new Date(challenge.deadline).getTime() : 0;
  const startedMs = challenge ? new Date(challenge.startedAt).getTime() : 0;
  const remaining = challenge ? deadlineMs - now : 0;
  const ended = !!challenge && remaining <= 0;

  // Safety net for the rollover: once the timer hits zero (or there is no
  // challenge yet), keep checking for the next one in case the socket
  // event was missed.
  useEffect(() => {
    if (!open || loadingChallenge || (challenge && !ended)) return;
    const id = setInterval(() => void loadChallenge(), 5000);
    return () => clearInterval(id);
  }, [open, loadingChallenge, challenge, ended, loadChallenge]);

  // Share of the challenge's time window still left, for the progress bar.
  const remainingPct = useMemo(() => {
    if (!challenge) return 0;
    const total = deadlineMs - startedMs;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, ((deadlineMs - now) / total) * 100));
  }, [challenge, deadlineMs, startedMs, now]);

  // Animated light-ray backdrop (dark mode only - hidden in light mode).
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

  const alreadyEntered = !!challenge?.mySubmission;
  const reward = challenge?.rewardId ? cosmetics.find((c) => c.reward_id === challenge.rewardId) ?? null : null;
  const unlockedCosmetics = cosmetics.filter((c) => c.is_unlocked);
  const equippedRelic = unlockedCosmetics.find((c) => c.is_equipped) ?? null;

  // Mine first, then newest (the backend already returns newest first).
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => Number(b.isMine) - Number(a.isMine)),
    [entries]
  );

  function handleJoined(result: {
    submission: ActiveChallenge['mySubmission'];
    playbackStarted: boolean;
    playbackError: string | null;
  }) {
    setChallenge((current) => (current ? { ...current, mySubmission: result.submission } : current));
    if (!result.playbackStarted && result.playbackError) setPlaybackNotice(result.playbackError);
    // Joining grants the challenge's border - refresh what's unlocked.
    fetchCosmeticsInventory()
      .then(setCosmetics)
      .catch((err) => console.error('Could not refresh cosmetics:', err.message));
    if (challenge) void loadEntries(challenge.id);
  }

  async function selectBorder(rewardId: string | null) {
    if (equipping) return;
    const target = rewardId ?? equippedRelic?.reward_id ?? null;
    if (!target) return;
    const nextEquipped = rewardId !== null;

    setEquipping(true);
    try {
      await equipCosmetic(target, nextEquipped);
      setCosmetics((current) =>
        current.map((item) => ({
          ...item,
          is_equipped: nextEquipped ? item.reward_id === rewardId : false,
        }))
      );
    } catch (err) {
      console.error('Could not update cosmetic:', err instanceof Error ? err.message : err);
    } finally {
      setEquipping(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-wl-scrim px-3 pb-6 pt-[4vh] backdrop-blur-sm sm:px-4 sm:pt-[6vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Dark mode keeps the vivid "glass dashboard" look ported from an
              earlier mockup round. Light mode gets its own pale-sky
              treatment via the `light:` variant (see index.css) - every
              hard-coded dark/white-alpha surface and light-on-dark text
              colour below has a matching `light:` override, since those
              don't follow the theme tokens on their own. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Weekly Challenge"
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-wl-panel/90 shadow-[0_30px_80px_rgba(2,10,25,0.6)] backdrop-blur-xl light:border-sky-200 light:shadow-[0_30px_80px_rgba(8,36,58,0.25)] lg:max-w-4xl"
            initial={{ opacity: 0, scale: 0.94, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-400/20 bg-white/[0.02] px-5 py-4 light:border-sky-200 light:bg-sky-50 sm:px-6">
              <span className="flex items-center gap-2 text-base font-semibold text-cyan-100 light:text-sky-950 sm:text-lg">
                <Trophy className="h-5 w-5 text-amber-300 light:text-amber-600" />
                Weekly Challenge
              </span>

              <button
                aria-label="Close panel"
                onClick={onClose}
                className="text-cyan-300/70 transition hover:text-cyan-200 light:text-sky-700 light:hover:text-sky-950"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="nav-panel-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-b from-[#0e3a5a] via-[#061e38] to-[#020914] px-4 py-6 font-sans text-slate-100 antialiased selection:bg-cyan-500/30 light:from-sky-100 light:via-sky-50 light:to-white light:text-slate-800 sm:px-6">
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80 light:hidden"
              />

              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-gradient-to-b from-cyan-300/20 via-sky-400/10 to-transparent blur-md light:from-sky-300/40 light:via-sky-200/20" />

              {loadingChallenge && !challenge ? (
                <div className="relative z-10 flex items-center justify-center py-16 text-xs font-medium text-cyan-200/70 light:text-sky-800">
                  Loading this week&apos;s challenge…
                </div>
              ) : !challenge ? (
                <div className="relative z-10 flex items-center justify-center py-16 text-xs font-medium text-slate-300/80 light:text-slate-600">
                  The next challenge is starting - check back in a moment.
                </div>
              ) : (
                <div className="relative z-10 space-y-5">
                  {/* 1. HERO / THEME CARD */}
                  <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 via-white/[0.04] to-transparent p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl light:border-sky-200 light:from-white light:via-white/80 light:to-sky-50/60 light:shadow-[0_12px_32px_rgba(8,36,58,0.12)] sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)] backdrop-blur-md light:bg-amber-100 light:shadow-none">
                        <Trophy className="h-3.5 w-3.5 text-amber-300 light:text-amber-700" />
                        <span className="text-xs font-semibold text-amber-100 light:text-amber-900">
                          This Week&apos;s Challenge
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 backdrop-blur-md light:border-sky-200 light:bg-white">
                        <Clock className="h-3.5 w-3.5 text-cyan-300 light:text-cyan-700" />
                        <span className="font-mono text-xs font-medium text-slate-200 light:text-slate-700">
                          {ended ? 'Ended' : formatCountdown(remaining)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/90 light:text-cyan-700">
                      Weekly Theme
                    </p>

                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white light:text-sky-950 sm:text-3xl">
                      {challenge.theme}
                    </h2>

                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300/90 light:text-slate-600">
                      {challenge.description}
                    </p>

                    {/* Time window: bar drains as the challenge runs out. */}
                    <div className="mt-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10 light:bg-sky-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300 transition-[width] duration-1000 ease-linear"
                          style={{ width: `${remainingPct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400 light:text-slate-500">
                        {ended ? 'This challenge has ended.' : `Ends ${formatEnd(challenge.deadline)}`}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-200 light:border-sky-200 light:bg-sky-50 light:text-slate-700">
                        <Users className="h-3.5 w-3.5 text-cyan-400 light:text-cyan-600" />
                        <span>{challenge.participantCount} joined</span>
                      </div>

                      {reward && (
                        <button
                          type="button"
                          onClick={() => setRewardPreviewOpen(true)}
                          title="Preview this border"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-500/20 light:bg-amber-50 light:text-amber-900 light:hover:bg-amber-100"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-300 light:text-amber-600" />
                          <span>
                            Limited reward: {reward.name}
                            {reward.is_unlocked ? ' (unlocked)' : ''}
                          </span>
                          <span className="ml-0.5 inline-flex items-center gap-1 border-l border-amber-400/30 pl-2 font-semibold">
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </span>
                        </button>
                      )}

                      {alreadyEntered && (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 light:bg-emerald-100 light:text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 light:text-emerald-600" />
                          <span>Joined ✓</span>
                        </div>
                      )}
                    </div>

                    {/* Join / your entry */}
                    <div className="mt-5">
                      {alreadyEntered && challenge.mySubmission ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 light:border-sky-200">
                            <Cover song={challenge.mySubmission} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 light:text-emerald-700">
                              Your entry
                            </p>
                            <p className="truncate text-sm font-semibold text-white light:text-sky-950">
                              {challenge.mySubmission.title}
                            </p>
                            <p className="truncate text-xs text-slate-300/80 light:text-slate-600">
                              {challenge.mySubmission.artist}
                            </p>
                            {playbackNotice && (
                              <p className="mt-1 text-[11px] text-emerald-200/80 light:text-emerald-700/90">
                                {playbackNotice}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : ended ? (
                        <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xs font-medium text-slate-300 light:border-sky-200 light:bg-white light:text-slate-600">
                          This challenge has ended - the next one is starting…
                        </p>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => setJoinOpen(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-3 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        >
                          <Plus className="h-4 w-4" />
                          Join this challenge
                        </motion.button>
                      )}
                    </div>
                  </section>

                  {/* 2. PROFILE BORDER (compact - opens a dropdown picker) */}
                  <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 px-4 py-3 backdrop-blur-xl light:border-sky-200 light:from-white light:to-sky-50 light:shadow-[0_6px_20px_rgba(8,36,58,0.08)]">
                    <div className="flex min-w-0 items-center gap-3">
                      <BorderFrame border={equippedRelic?.css_class} shape="circle" className={`h-10 w-10 ${equippedRelic ? 'mx-3' : ''}`}>
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-cyan-300 bg-slate-800">
                          {profile?.profileImage ? (
                            <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold text-slate-200">
                              {(profile?.displayName || '?').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </BorderFrame>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80 light:text-cyan-700">
                          Profile border
                        </p>
                        <p className="truncate text-sm font-semibold text-white light:text-sky-950">
                          {equippedRelic ? equippedRelic.name : 'No border equipped'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBorderOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/25 light:border-cyan-400/60 light:bg-cyan-50 light:text-cyan-800 light:hover:bg-cyan-100"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      {unlockedCosmetics.length > 0 ? 'Change border' : 'Borders'}
                    </button>
                  </section>

                  {/* 3. ENTRIES - everyone's songs for this challenge */}
                  <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#061b2e]/80 to-[#030d17]/90 p-4 backdrop-blur-xl light:border-sky-200 light:from-white light:to-sky-50 light:shadow-[0_6px_20px_rgba(8,36,58,0.08)] sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ListMusic className="h-4 w-4 text-cyan-300 light:text-cyan-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white light:text-sky-950">
                          Challenge entries
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-400 light:text-slate-500">
                        {entries.length} {entries.length === 1 ? 'song' : 'songs'}
                      </span>
                    </div>

                    {entriesLoading && entries.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400 light:text-slate-500">Loading entries…</p>
                    ) : entriesError && entries.length === 0 ? (
                      <p className="py-6 text-center text-xs text-wl-danger">{entriesError}</p>
                    ) : entries.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400 light:text-slate-500">
                        No entries yet - be the first to join!
                      </p>
                    ) : (
                      <ul className="no-scrollbar max-h-72 space-y-2 overflow-y-auto pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.75rem),transparent)]">
                        {sortedEntries.map((entry) => (
                          <li
                            key={entry.spotifyUserId}
                            className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                              entry.isMine
                                ? 'border-cyan-400/50 bg-cyan-500/10 light:border-cyan-400 light:bg-cyan-50'
                                : 'border-white/10 bg-black/30 light:border-sky-200 light:bg-white'
                            }`}
                          >
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 light:border-sky-200">
                              <Cover song={entry} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white light:text-slate-900">
                                {entry.title}
                              </p>
                              <p className="truncate text-xs text-slate-300/80 light:text-slate-600">{entry.artist}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="max-w-[7rem] truncate text-[11px] font-medium text-slate-200 light:text-slate-700">
                                  {entry.isMine ? 'You' : entry.displayName}
                                </span>
                                <BorderFrame border={entry.border} shape="circle" className="h-5 w-5" reserve="m-3.5">
                                  <span className="block h-full w-full overflow-hidden rounded-full bg-slate-700">
                                    {entry.profileImage && (
                                      <img src={entry.profileImage} alt="" className="h-full w-full object-cover" />
                                    )}
                                  </span>
                                </BorderFrame>
                              </div>
                              <span className="text-[10px] text-slate-400 light:text-slate-500">
                                {timeAgo(entry.submittedAt)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>

            {challenge && (
              <JoinChallengeModal
                open={joinOpen && !alreadyEntered && !ended}
                challenge={challenge}
                onClose={() => setJoinOpen(false)}
                onJoined={handleJoined}
              />
            )}
            <BorderPickerModal
              open={borderOpen}
              onClose={() => setBorderOpen(false)}
              cosmetics={cosmetics}
              onSelect={(id) => void selectBorder(id)}
              saving={equipping}
              profileImage={profile?.profileImage ?? null}
              initial={(profile?.displayName || '?').charAt(0).toUpperCase()}
            />
            <RewardPreviewModal
              open={rewardPreviewOpen}
              onClose={() => setRewardPreviewOpen(false)}
              reward={reward}
              profileImage={profile?.profileImage ?? null}
              initial={(profile?.displayName || '?').charAt(0).toUpperCase()}
              onEquip={(id) => void selectBorder(id)}
              saving={equipping}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
