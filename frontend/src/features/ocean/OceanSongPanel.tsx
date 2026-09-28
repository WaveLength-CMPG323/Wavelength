import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Play, Pause } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import { joinTrack, followHost, unfollowHost, fetchFollowStatus } from '../../lib/api';
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
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Reset transient UI state whenever a different song is opened, and tick
  // a local clock so the progress bar keeps moving between server updates
  // (mirrors getLiveProgressMs on the backend).
  useEffect(() => {
    setError('');
  }, [group?.trackId]);

  useEffect(() => {
    if (!group) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [group?.trackId]);

  // Restore the REAL Follow Along state from the backend whenever a song
  // is opened, rather than always assuming "not following" - the
  // relationship persists on the server even if this panel gets closed
  // and reopened, or the page is refreshed.
  useEffect(() => {
    if (!group || !isLoggedIn) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    fetchFollowStatus()
      .then(({ followingHostSessionId }) => {
        if (!cancelled) setFollowing(followingHostSessionId === group.hostSessionId);
      })
      .catch(() => {
        // non-fatal - leave it showing "not following" if the check fails
      });
    return () => {
      cancelled = true;
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
      } else {
        await followHost(group.trackId);
        setFollowing(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Follow Along');
    }
  }

  return (
    <AnimatePresence>
      {group && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="no-scrollbar flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl border border-cyan-500/20 bg-[#04385a] p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <button onClick={onClose} aria-label="Close" className="self-end text-cyan-300/70 hover:text-cyan-200" type="button">
              <X className="h-5 w-5" />
            </button>

            {/* shrink-0 matters here: this panel is a flex-col column, and
                without it the browser can compress this box's HEIGHT (but
                not its width) to fit everything within max-h-[85vh] once
                enough content is added below - turning a square into a
                short wide rectangle. shrink-0 locks it at a true 256x256
                regardless of how much else is in the panel; the panel
                scrolls instead. */}
            <div className="mx-auto flex aspect-square h-64 w-64 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cyan-950 shadow-lg">
              {group.albumArt ? (
                <img src={group.albumArt} alt={`${group.trackName} cover art`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-6xl font-light text-cyan-100/80">
                  {group.trackName.trim().charAt(0).toUpperCase() || '♪'}
                </span>
              )}
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-[#543ab7] to-cyan-400" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="-mt-3 flex justify-between text-[11px] text-slate-400">
              <span>{formatMs(liveProgressMs)}</span>
              <span>{formatMs(group.durationMs)}</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-cyan-300/70">
              {group.isPlaying ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
              <span className="text-xs">{group.isPlaying ? 'Playing' : 'Paused'}</span>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-cyan-100">{group.trackName}</div>
              <div className="text-sm text-slate-400">{group.artist}</div>
              <div className="mt-1 text-xs text-slate-500">
                {group.listenerCount} {group.listenerCount === 1 ? 'listener' : 'listeners'}
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={isMyTrack || joining}
              className="w-full rounded-full bg-[#1ED760] py-2.5 text-sm font-semibold text-black hover:bg-[#1fdf64] disabled:opacity-50"
              type="button"
            >
              {isMyTrack ? 'Already listening' : joining ? 'Starting…' : 'Listen on Spotify'}
            </button>

            <button
              onClick={handleFollowToggle}
              disabled={isMyTrack}
              className={`rounded-full py-2 text-sm font-semibold disabled:opacity-40 ${
                following ? 'bg-[#543ab7] text-white' : 'bg-white/10 text-white'
              }`}
              type="button"
            >
              {following ? 'Following Along ✓' : 'Follow Along'}
            </button>
            <p className="-mt-2 text-center text-[11px] text-slate-500">
              {following
                ? "You'll automatically switch whenever the host skips."
                : "You'll finish this song even if the host skips ahead."}
            </p>

            {error && (
              <div className="text-center text-xs text-red-400">
                <p>{error}</p>
                {/* If Join can't remote-control playback (no Premium, or no
                    active device anywhere), this is the fallback: opening
                    the track directly so they can still listen manually. */}
                <a
                  href={trackUrl(group.trackUri)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-cyan-300 underline hover:text-cyan-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Spotify instead
                </a>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-white/10 pt-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
                {group.hostProfileImage && (
                  <img src={group.hostProfileImage} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <span className="flex-1 truncate text-left text-xs text-slate-300">
                Started by <b className="font-medium text-white">{group.hostDisplayName || 'someone'}</b>
              </span>
              {group.hostSpotifyUserId && (
                <Link
                  to={`/hosts/${group.hostSpotifyUserId}`}
                  onClick={onClose}
                  className="whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                >
                  View Profile
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
