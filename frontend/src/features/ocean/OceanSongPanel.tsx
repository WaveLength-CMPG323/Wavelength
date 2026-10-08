import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Play, Pause, Radio, Check, Heart } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import { joinTrack, followHost, unfollowHost, fetchFollowStatus, saveTrackToLibrary } from '../../lib/api';
import BorderFrame from '../../components/BorderFrame';
import type { OceanGroup } from '../../data/types';

function formatMs(ms: number): string {
  if (!ms && ms !== 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// spotify:track:XXXX -> https://open.spotify.com/track/XXXX (only used as
// a fallback link if "Listen on Spotify" itself fails - see below).
function trackUrl(trackUri: string): string {
  const id = trackUri.split(':').pop();
  return `https://open.spotify.com/track/${id}`;
}

interface Props {
  group: OceanGroup | null;
  myTrackId: string | null;
  onClose: () => void;
}

// The Ocean page's song panel, wired to the real backend: shows live
// listener count + host attribution (backend/lib/oceanState.js).
//
// "Listen on Spotify" calls the real /spotify/join endpoint to
// remote-control your own active Spotify device to this exact track, at
// the host's live position - no browser tab opens.
//
// "Follow Along" is a real, persistent toggle (backend/lib/oceanState.js's
// follows map): while on, the backend's poller automatically pushes your
// Spotify onto whatever the host switches to, every ~2s (see
// syncFollowers() in spotifyPoller.js). While off, your own playback is
// left alone entirely, so you hear the current song through to the end
// regardless of what the host does.
//
// "View Profile" no longer opens the host's real Spotify page - it opens
// their read-only Wavelength profile instead (HostProfilePage), which
// only shows what's actually available for a third party: their name,
// avatar, and public playlists (Spotify's API doesn't expose recently-
// played for anyone but yourself, so that section isn't there for hosts).
//
// This is deliberately a separate component from
// features/song-details/SongDetailsPanel.tsx, which still shows the mock
// "shared tracks" social panel (like/save/follow/chat) on user profile
// pages - that data model (an owner with likes/saves/followers) doesn't
// exist yet for real Spotify sessions, so the two panels aren't merged.
export default function OceanSongPanel({ group, myTrackId, onClose }: Props) {
  const { isLoggedIn, login } = useAuth();
  const [joining, setJoining] = useState(false);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState('');
  const [followError, setFollowError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Reset transient UI state whenever a different song is opened, and tick
  // a local clock so the progress bar keeps moving between server updates
  // (mirrors getLiveProgressMs on the backend).
  useEffect(() => {
    setError('');
    setSaved(false);
    setSaving(false);
    setSaveError('');
  }, [group?.trackId]);

  useEffect(() => {
    if (!group) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [group?.trackId]);

  // Restore the REAL Follow Along state from the backend whenever a song
  // is opened, rather than always assuming "not following" - the
  // relationship persists on the server even if this panel gets closed
  // and reopened, or the page is refreshed. Then, while actively
  // following, keep polling the same endpoint so a background sync
  // failure (see spotifyPoller.js's syncFollowers()) actually reaches the
  // person instead of the toggle just sitting there looking "on" forever
  // with nothing visibly happening - that silence was indistinguishable
  // from a genuine bug.
  useEffect(() => {
    if (!group || !isLoggedIn) {
      setFollowing(false);
      setFollowError('');
      return;
    }
    let cancelled = false;

    function poll() {
      fetchFollowStatus()
        .then(({ followingHostSessionId, lastError }) => {
          if (cancelled) return;
          setFollowing(followingHostSessionId === group!.hostSessionId);
          setFollowError(followingHostSessionId === group!.hostSessionId ? lastError || '' : '');
        })
        .catch(() => {
          // non-fatal - leave the last known state showing if a poll fails
        });
    }

    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Only re-check when the song or its host actually changes - not on
    // every ~1s socket update, which would create a new `group` object
    // with the same trackId/hostSessionId and needlessly refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.trackId, group?.hostSessionId, isLoggedIn]);

  const isMyTrack = !!group && group.trackId === myTrackId;
  const liveProgressMs = group
    ? group.isPlaying
      ? Math.min(group.progressMs + (nowMs - group.lastPolledAt), group.durationMs || Infinity)
      : group.progressMs
    : 0;
  const progressPct = group && group.durationMs ? Math.min(100, (liveProgressMs / group.durationMs) * 100) : 0;

  async function handleJoin() {
    if (!group) return;
    if (!isLoggedIn) return login();
    setError('');
    setJoining(true);
    try {
      await joinTrack(group.trackUri, group.trackId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not play this song');
    } finally {
      setJoining(false);
    }
  }

  async function handleFollowToggle() {
    if (!group) return;
    if (!isLoggedIn) return login();
    setError('');
    try {
      if (following) {
        await unfollowHost();
        setFollowing(false);
        setFollowError('');
      } else {
        await followHost(group.trackId);
        setFollowing(true);
        setFollowError(''); // fresh follow - give the next background sync a clean slate
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Follow Along');
    }
  }

  async function handleSave() {
    if (!group) return;
    if (!isLoggedIn) return login();
    if (saved || saving) return;
    setSaveError('');
    setSaving(true);
    try {
      await saveTrackToLibrary(group.trackId);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this song');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {group && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-wl-scrim p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="no-scrollbar relative max-h-[90vh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-br from-[#4034a5]/95 via-[#285eb1]/95 to-[#137f9e]/95 p-6 text-white shadow-[0_24px_80px_rgba(5,10,40,0.45)] backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* Background glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />

            {/* Close */}
            <div className="relative flex justify-end">
              <button
                onClick={onClose}
                aria-label="Close"
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Album art */}
            <div className="relative mx-auto mt-1 flex h-48 w-48 items-center justify-center">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-purple-300/30 via-blue-300/25 to-cyan-300/30 blur-xl" />
              <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-cyan-950 shadow-2xl">
                {group.albumArt ? (
                  <img src={group.albumArt} alt={`${group.trackName} cover art`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-6xl font-light text-cyan-100/80">
                    {group.trackName.trim().charAt(0).toUpperCase() || '♪'}
                  </span>
                )}
              </div>
            </div>

            {/* Live progress bar - real data, ticked locally between server updates (see nowMs above) */}
            <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-cyan-300 to-cyan-400" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="-mt-1 flex justify-between text-[11px] text-white/50">
              <span>{formatMs(liveProgressMs)}</span>
              <span>{formatMs(group.durationMs)}</span>
            </div>

            <div className="mt-1 flex items-center justify-center gap-1.5 text-cyan-200/70">
              {group.isPlaying ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
              <span className="text-xs">{group.isPlaying ? 'Playing' : 'Paused'}</span>
            </div>

            {/* Song Details */}
            <div className="relative mt-3 text-center">
              <h2 className="mt-2 text-2xl font-bold text-white">{group.trackName}</h2>

              <p className="mt-1 text-sm text-white/60">{group.artist}</p>

              {/* Genre tags - sourced from the primary artist's genres
                  (Spotify genres live on the artist, not the track - see
                  backend/lib/genreCache.js). Can be empty if the artist
                  has none tagged on Spotify, so this section just doesn't
                  render rather than showing an empty row. */}
              {group.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {group.genres.slice(0, 4).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-medium capitalize text-cyan-200"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-1 text-xs text-white/40">
                {group.listenerCount} {group.listenerCount === 1 ? 'listener' : 'listeners'}
              </p>
            </div>

            {/* Host with real attribution - links to their read-only Wavelength profile */}
            {group.hostSpotifyUserId ? (
              <Link
                to={`/hosts/${group.hostSpotifyUserId}`}
                onClick={onClose}
                className="relative mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-left transition hover:bg-white/[0.13]"
              >
                <BorderFrame border={group.activeEffectCss} shape="circle" className="h-11 w-11" reserve="m-4">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10">
                    {group.hostProfileImage && (
                      <img src={group.hostProfileImage} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                </BorderFrame>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">Host</p>
                  <p className="truncate text-sm font-semibold text-white">{group.hostDisplayName || 'someone'}</p>
                </div>
                <span className="text-xs text-white/40">View profile</span>
              </Link>
            ) : (
              <div className="relative mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-left">
                <BorderFrame border={group.activeEffectCss} shape="circle" className="h-11 w-11" reserve="m-4">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10">
                    {group.hostProfileImage && (
                      <img src={group.hostProfileImage} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                </BorderFrame>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">Host</p>
                  <p className="truncate text-sm font-semibold text-white">{group.hostDisplayName || 'someone'}</p>
                </div>
              </div>
            )}

            {/* Primary actions */}
            <div className="relative mt-5 space-y-3">
              <div className="flex items-stretch gap-2">
                <button
                  onClick={handleJoin}
                  disabled={isMyTrack || joining}
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#091533] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#111d43] disabled:opacity-50"
                >
                  <ExternalLink className="h-4 w-4 text-[#1ED760]" />
                  {isMyTrack ? 'Already listening' : joining ? 'Starting…' : 'Listen on Spotify'}
                </button>

                <button
                  onClick={handleSave}
                  disabled={saved || saving}
                  type="button"
                  aria-label={saved ? 'Saved to Liked Songs' : 'Save to Playlist'}
                  title={saved ? 'Saved to Liked Songs' : 'Save to Playlist'}
                  className={`flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-md transition disabled:cursor-not-allowed ${
                    saved
                      ? 'bg-cyan-200/20 text-cyan-200'
                      : 'bg-[#091533] text-white hover:bg-[#111d43] disabled:opacity-50'
                  }`}
                >
                  {saved ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4 text-[#1ED760]" />}
                  <span className="hidden sm:inline">{saved ? 'Saved' : saving ? 'Saving…' : 'Save to Playlist'}</span>
                </button>
              </div>

              {saved && (
                <p className="text-center text-[11px] text-white/45">Saved to Liked Songs</p>
              )}
              {saveError && (
                <p className="text-center text-xs text-red-300">{saveError}</p>
              )}

              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isMyTrack}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 transition disabled:opacity-40 ${
                  following
                    ? 'border-cyan-200/50 bg-cyan-200/20'
                    : 'border-white/15 bg-white/[0.08] hover:bg-white/[0.13]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      following ? 'bg-cyan-200 text-[#173b6f]' : 'bg-white/10 text-cyan-100'
                    }`}
                  >
                    <Radio className="h-4 w-4" />
                  </div>

                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">Follow Along</p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {following
                        ? "You'll automatically switch whenever the host skips."
                        : "You'll finish this song even if the host skips ahead."}
                    </p>
                  </div>
                </div>

                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    following ? 'bg-cyan-200' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      following ? 'left-6' : 'left-1'
                    }`}
                  />
                </span>
              </button>

              {!isLoggedIn && (
                <p className="text-center text-[11px] text-white/45">
                  Log in with Spotify to follow along with another listener.
                </p>
              )}
            </div>

            {followError && (
              <p className="relative mt-2 text-center text-xs text-red-300">{followError}</p>
            )}

            {error && (
              <div className="relative mt-3 text-center text-xs text-red-300">
                <p>{error}</p>
                {/* If Join can't remote-control playback (no Premium, or no
                    active device anywhere), this is the fallback: opening
                    the track directly so they can still listen manually. */}
                <a
                  href={trackUrl(group.trackUri)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-cyan-200 underline hover:text-cyan-100"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Spotify instead
                </a>
              </div>
            )}

            <p className="relative mt-5 text-center text-[10px] text-white/30">
              Song metadata and artwork provided by Spotify
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
