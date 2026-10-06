import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Music, RefreshCw, Sparkles, Users } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import { OceanWaveIcon } from '../../components/icons/OceanWaveIcon';
import AvatarPreview from './AvatarPreview';
import ChallengeRewardsPanel from './ChallengeRewardsPanel';
import { useAuth } from '../../data/AuthContext';
import { formatCountdown, timeAgo } from '../../data/mockData';
import {
  completeChallenge,
  fetchCurrentChallenge,
  fetchEligibleTracks,
  setActiveCosmetic,
} from '../../lib/api';
import type { CompleteChallengeResult, CurrentChallenge, EligibleTrack } from '../../data/types';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function TrackArt({ src, size }: { src: string | null; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded bg-cyan-950"
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Music className="h-4 w-4 text-cyan-500/50" />}
    </div>
  );
}

// This week's challenge. The backend picks it from the calendar (a new one
// every week, each with its own cosmetic), and verifies the song you submit
// against your real Spotify listening - so the only songs offered here are
// ones you've actually played this week.
export default function WeeklyChallengePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refresh } = useAuth();

  const [data, setData] = useState<CurrentChallenge | null>(null);
  const [loadError, setLoadError] = useState('');
  const [skew, setSkew] = useState(0); // server clock minus device clock
  const [remaining, setRemaining] = useState(0);

  const [tracks, setTracks] = useState<EligibleTrack[] | null>(null);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [result, setResult] = useState<CompleteChallengeResult | null>(null);
  const [equipBusy, setEquipBusy] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const loadChallenge = useCallback(async (): Promise<CurrentChallenge | null> => {
    try {
      const d = await fetchCurrentChallenge();
      setData(d);
      setSkew(d.serverNow - Date.now());
      setRemaining(d.challenge.endsAt - d.serverNow);
      setLoadError('');
      return d;
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load this week's challenge"));
      return null;
    }
  }, []);

  const loadTracks = useCallback(async () => {
    setTracksLoading(true);
    setTracksError('');
    try {
      const t = await fetchEligibleTracks();
      setTracks(t);
      setSelected((prev) => (prev && t.some((x) => x.trackId === prev) ? prev : null));
    } catch (err) {
      setTracksError(errorMessage(err, 'Could not load your listening history'));
    } finally {
      setTracksLoading(false);
    }
  }, []);

  // Fresh load every time the panel opens.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setActionError('');
    setSelected(null);
    setTracks(null);
    loadChallenge().then((d) => {
      if (d?.me && !d.me.completed) loadTracks();
    });
  }, [open, loadChallenge, loadTracks]);

  // Countdown against the server's clock. When it hits zero a new week has
  // started, so pull the new challenge instead of leaving a stale one up.
  const endsAt = data?.challenge.endsAt;
  const rollingOver = useRef(false);
  useEffect(() => {
    if (!open || !endsAt) return;
    const id = setInterval(() => {
      const left = endsAt - (Date.now() + skew);
      setRemaining(left);
      if (left <= 0 && !rollingOver.current) {
        rollingOver.current = true;
        setResult(null);
        loadChallenge()
          .then((d) => {
            if (d?.me && !d.me.completed) loadTracks();
          })
          .finally(() => {
            rollingOver.current = false;
          });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [open, endsAt, skew, loadChallenge, loadTracks]);

  async function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      const r = await completeChallenge(selected);
      setResult(r);
      await loadChallenge(); // refresh "completed" status + the community count
    } catch (err) {
      setActionError(errorMessage(err, 'Could not complete the challenge'));
      loadChallenge(); // e.g. already completed from another tab - resync
    } finally {
      setSubmitting(false);
    }
  }

  const cosmetic = data?.challenge.cosmetic ?? null;
  const completed = !!data?.me?.completed;
  const ownsCosmetic = completed || !!data?.me?.ownsCosmetic;
  const equipped = !!cosmetic && profile?.activeCosmetic?.id === cosmetic.id;

  async function toggleEquip() {
    if (!cosmetic) return;
    setEquipBusy(true);
    setActionError('');
    try {
      await setActiveCosmetic(equipped ? null : cosmetic.id);
      refresh(); // nav avatar + profile re-read /auth/me
    } catch (err) {
      setActionError(errorMessage(err, 'Could not update your cosmetic'));
    } finally {
      setEquipBusy(false);
    }
  }

  const completedTrack = data?.me?.completion?.track ?? result?.completion.track ?? null;

  return (
    <>
      <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
        <div className="flex flex-col gap-4 px-6 py-5">
          {loadError && <p className="text-xs text-red-400">{loadError}</p>}
          {!data && !loadError && <p className="text-xs text-slate-400">Loading…</p>}

          {data && cosmetic && (
            <>
              {/* The challenge */}
              <div className="rounded-xl border border-cyan-500/20 bg-[#02233b]/80 p-4 shadow-md backdrop-blur-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium uppercase text-cyan-300">
                    <OceanWaveIcon className="h-3 w-3" />
                    {data.challenge.theme}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {remaining > 0 ? `${formatCountdown(remaining)} left` : 'Starting a new week…'}
                  </span>
                </div>
                <p className="mt-3 text-base font-medium text-cyan-100">{data.challenge.description}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Share a song you’ve listened to this week. Complete it to unlock a profile cosmetic that’s yours to
                  keep.
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-3 text-xs">
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Users className="h-3.5 w-3.5 text-cyan-400" />
                    {data.participantCount === 0
                      ? 'Be the first to complete it'
                      : `${data.participantCount} ${data.participantCount === 1 ? 'person has' : 'people have'} completed it`}
                  </span>
                  {completed && (
                    <span className="flex items-center gap-1 font-semibold text-cyan-300">
                      <Check className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </div>
              </div>

              {/* This week's reward, previewed on the user's own avatar */}
              <div className="flex items-center gap-4 rounded-xl border border-cyan-500/20 bg-[#02182b] p-4">
                <AvatarPreview cosmetic={cosmetic} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">This week’s reward</p>
                  <p className="text-sm font-semibold text-cyan-100">{cosmetic.name}</p>
                  <p className="text-xs text-slate-400">{cosmetic.description}</p>
                </div>
                {ownsCosmetic && (
                  <button
                    type="button"
                    onClick={toggleEquip}
                    disabled={equipBusy}
                    aria-pressed={equipped}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      equipped
                        ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                        : 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                    }`}
                  >
                    {equipped ? 'Equipped ✓' : 'Equip'}
                  </button>
                )}
              </div>

              {/* Logged out */}
              {!data.me && <p className="text-center text-xs text-slate-400">Log in with Spotify to take part.</p>}

              {/* Completed */}
              {completed && (
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-cyan-100">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    {result
                      ? result.alreadyOwned
                        ? 'Challenge complete! You already owned this one.'
                        : `Challenge complete! You unlocked ${result.cosmetic.name}.`
                      : 'You’ve completed this week’s challenge.'}
                  </p>
                  {completedTrack && (
                    <div className="mt-3 flex items-center gap-3">
                      <TrackArt src={completedTrack.albumArt} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-cyan-100">{completedTrack.name}</p>
                        <p className="truncate text-xs text-slate-400">{completedTrack.artist}</p>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-400">A new challenge, and a new cosmetic, arrives next week.</p>
                </div>
              )}

              {/* Not completed yet: pick a song */}
              {data.me && !completed && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                      Pick a song you’ve heard this week
                    </p>
                    <button
                      type="button"
                      onClick={loadTracks}
                      disabled={tracksLoading}
                      aria-label="Refresh your listening"
                      className="rounded-full p-1.5 text-cyan-300/70 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${tracksLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {tracksError && <p className="text-xs text-red-400">{tracksError}</p>}
                  {!tracks && !tracksError && <p className="text-xs text-slate-400">Loading your listening…</p>}

                  {tracks && tracks.length === 0 && !tracksError && (
                    <p className="rounded-lg border border-dashed border-cyan-500/20 p-4 text-center text-xs text-slate-400">
                      Nothing played this week yet. Play a song on Spotify, then tap refresh.
                    </p>
                  )}

                  {tracks && tracks.length > 0 && (
                    <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-cyan-500/20 bg-[#02182b] p-1.5">
                      {tracks.map((t) => {
                        const isSelected = selected === t.trackId;
                        return (
                          <li key={t.trackId}>
                            <button
                              type="button"
                              onClick={() => setSelected(t.trackId)}
                              aria-pressed={isSelected}
                              className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition ${
                                isSelected ? 'border-cyan-400 bg-cyan-500/15' : 'border-transparent hover:bg-cyan-500/10'
                              }`}
                            >
                              <TrackArt src={t.albumArt} size={40} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-cyan-100">{t.name}</p>
                                <p className="truncate text-xs text-slate-400">{t.artist}</p>
                              </div>
                              {t.nowPlaying ? (
                                <span className="shrink-0 rounded-full bg-[#1ED760]/20 px-2 py-0.5 text-[10px] font-semibold text-[#1ED760]">
                                  Now playing
                                </span>
                              ) : (
                                t.playedAt && (
                                  <span className="shrink-0 text-[11px] text-slate-500">
                                    {timeAgo(new Date(t.playedAt).getTime())}
                                  </span>
                                )
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {actionError && <p className="text-xs text-red-400">{actionError}</p>}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={!selected || submitting}
                    className="mt-1 rounded-full bg-cyan-400 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? 'Submitting…' : 'Complete challenge'}
                  </button>
                  <p className="text-center text-xs text-slate-500">One entry per week.</p>
                </div>
              )}

              {completed && actionError && <p className="text-xs text-red-400">{actionError}</p>}

              {data.me && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setRewardsOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Sparkles className="h-4 w-4" />
                  View my rewards
                </button>
              )}
            </>
          )}
        </div>
      </NavPanel>

      <ChallengeRewardsPanel open={rewardsOpen} onClose={() => setRewardsOpen(false)} />
    </>
  );
}
