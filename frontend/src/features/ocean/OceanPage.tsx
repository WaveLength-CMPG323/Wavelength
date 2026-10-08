import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../data/AuthContext';
import OceanNav from './OceanNav';
import WeeklyChallengeButton from './WeeklyChallengeButton';
import { useOceanCanvas, type OceanMarker } from './useOceanCanvas';
import OceanSongPanel from './OceanSongPanel';
import SkyScene from './SkyScene';
import NotificationsPanel from '../notifications/NotificationsPanel';
import WeeklyChallengePanel from '../challenges/WeeklyChallengePanel';
import GuestWelcome from './GuestWelcome';
import { getSocket } from '../../lib/socket';
import { fetchCurrentlyPlaying } from '../../lib/api';
import type { OceanGroup } from '../../data/types';

// Multi-token, order-independent match ("like Claude's" search-as-you-type):
// splits the query on whitespace and requires EVERY token to appear
// somewhere in the haystack, case-insensitively - so "weeknd blind" matches
// "Blinding Lights" / "The Weeknd" regardless of word order, which a plain
// whole-string .includes() can't do. An empty query always matches
// (preserves the existing "no filter" behavior).
function matchesQuery(haystack: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = haystack.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}

export default function OceanPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(params.get('song'));
  const [notifOpen, setNotifOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  // Live groups (one per track currently playing across all logged-in
  // users), pushed over Socket.IO by the backend's poller roughly once a
  // second - see backend/lib/spotifyPoller.js. Public: guests get this too.
  const [groups, setGroups] = useState<Record<string, OceanGroup>>({});

  // Whatever track I'M personally playing right now (null when paused,
  // stopped or unknown) - drives the "Your song" marker and the panel's
  // "you're already listening" state.
  const [myTrackId, setMyTrackId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    function onUpdate(incoming: OceanGroup[]) {
      const next: Record<string, OceanGroup> = {};
      incoming.forEach((g) => {
        next[g.trackId] = g;
      });
      setGroups(next);
    }
    socket.on('oceanUpdate', onUpdate);
    return () => {
      socket.off('oceanUpdate', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setMyTrackId(null);
      return;
    }
    let cancelled = false;
    let failures = 0;
    async function poll() {
      try {
        const data = await fetchCurrentlyPlaying();
        failures = 0;
        // Spotify keeps reporting the last track (is_playing: false) long
        // after playback stopped - only a track that is really playing
        // counts as "mine", otherwise an old song stays highlighted.
        if (!cancelled) setMyTrackId(data.playing ? data.trackId ?? null : null);
      } catch {
        // A blip keeps the last value, but a run of failures means we no
        // longer know what's playing - don't show an old song as current.
        failures += 1;
        if (!cancelled && failures >= 3) setMyTrackId(null);
      }
    }
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoggedIn]);

  const markers: OceanMarker[] = useMemo(() => {
    return Object.values(groups)
      .filter((g) => matchesQuery(`${g.trackName} ${g.artist} ${g.genres.join(' ')}`, query))
      .map((g) => ({
        id: g.trackId,
        song: { id: g.trackId, title: g.trackName, artist: g.artist, cover: g.albumArt, ownerId: g.hostSessionId },
        isMine: g.trackId === myTrackId,
        listenerCount: g.listenerCount,
        activeEffectCss: g.activeEffectCss ?? null,
      }));
  }, [groups, query, myTrackId]);

  // Jumps to a song's panel - shared by clicking its floating bubble on
  // the canvas (via useOceanCanvas's onSelect below) and clicking it in
  // the search dropdown (onSelectResult passed to OceanNav).
  function selectTrack(trackId: string) {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    setSelectedTrackId(trackId);
  }

  // Live search-results dropdown data (top ~6 matches) for OceanNav to
  // render under the search bar while its input is focused and non-empty.
  // Computed here (not in OceanNav) since it needs the live `groups` data
  // that only exists on this page - OceanNav just renders what it's given
  // and reports clicks back via onSelectResult.
  // With an empty query this is every song currently playing (shown when
  // the search box is clicked); otherwise just the matches. Either way the
  // most-listened-to songs come first.
  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    return Object.values(groups)
      .filter((g) => matchesQuery(`${g.trackName} ${g.artist} ${g.genres.join(' ')}`, trimmed))
      .sort((a, b) => b.listenerCount - a.listenerCount || a.trackName.localeCompare(b.trackName))
      .map((g) => ({
        trackId: g.trackId,
        trackName: g.trackName,
        artist: g.artist,
        albumArt: g.albumArt,
        listenerCount: g.listenerCount,
      }));
  }, [groups, query]);

  const { canvasRef, containerRef, hoveredId } = useOceanCanvas({
    markers,
    // Guests can watch the ocean, but every interaction (join, follow,
    // even just opening a song's details) requires a real Spotify login -
    // send them to /login instead of opening the panel.
    onSelect: selectTrack,
    imageResolver: (song) => song.cover,
  });

  const hoveredGroup = hoveredId ? (groups[hoveredId] ?? null) : null;
  const selectedGroup = selectedTrackId ? (groups[selectedTrackId] ?? null) : null;
  const isEmpty = Object.keys(groups).length === 0;

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-wl-bg">
      {/* Ocean viewport - pushed up when the Weekly Challenge panel opens,
          revealing the seabed/treasure overlay below (ported from the
          redesigned mockup's OceanPage). */}
      <motion.div
        className="relative h-full w-full"
        animate={{ y: challengeOpen ? '-25%' : '0%' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* The sky above the waterline - gradient, sun/moon, stars, clouds
            and birds - lives as plain DOM/CSS behind the ocean canvas, which
            only paints the sea + waves (transparent above the waterline) so
            this shows through. See useOceanCanvas.ts's own theme-blending of
            the sea/wave/marker colors, choreographed to fade in step with
            this via --wl-theme-duration. */}
        <SkyScene />
        <canvas ref={canvasRef} className={`absolute inset-0 z-0 ${hoveredId ? 'cursor-pointer' : 'cursor-default'}`} />

        {/* Underwater Seabed and Treasure Environment Overlay */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 -bottom-[35vh] z-10 h-[60vh] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: challengeOpen ? 1 : 0 }}
          transition={{ duration: 0.9 }}
        >
          {/* Deep Seabed Gradient - top edge is feathered through the same
              cyan used by the bottom wave band (WAVE_BANDS[2].night in
              useOceanCanvas.ts is rgba(34,211,238,0.38)) so the seabed
              blends into the wave above it instead of showing a hard-edged
              dark rectangle cutting across it. The seabed itself stays an
              underwater-depth effect (not a "sky" element), so it keeps a
              dark gradient in both themes, and so do the chests resting on
              it (fixed amber/cyan, not the theme tokens - the light-mode
              tokens are pale/deep colours meant for a bright daytime
              surface and make the chests look washed out down here). */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top,
                #020712 0%,
                rgba(5,19,41,0.92) 30%,
                rgba(8,40,64,0.65) 48%,
                rgba(34,211,238,0.32) 62%,
                rgba(34,211,238,0.12) 80%,
                rgba(34,211,238,0) 100%)`,
            }}
          />

          {/* Caustic Light Rays */}
          <div className="absolute left-1/2 top-0 h-[450px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute left-[20%] top-10 h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[80px]" />
          <div className="absolute right-[20%] top-10 h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[80px]" />

          {/* Ocean Floor Ridge Line */}
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#01040a] to-transparent opacity-90" />

          {/* Left Treasure Chest Cluster 1 */}
          <div className="wl-chest-body absolute left-[8%] bottom-16 h-20 w-32 rounded-xl border backdrop-blur-sm">
            <div className="absolute -top-3 left-1/2 h-4 w-28 -translate-x-1/2 rounded-t-lg border-t border-amber-500/60 bg-amber-500/30" />
            <div className="absolute inset-x-0 top-1/2 h-1 bg-amber-500/40" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-500/80 bg-amber-500/60 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          </div>

          {/* Left Treasure Chest Cluster 2 (Smaller & Tilted) */}
          <div className="absolute left-[18%] bottom-10 h-14 w-22 -rotate-6 rounded-lg border border-cyan-400/50 bg-gradient-to-b from-cyan-600/40 to-cyan-950/80 shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-sm">
            <div className="absolute inset-x-0 top-1/2 h-1 bg-cyan-300/40" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-cyan-300/80 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </div>

          {/* Center Left Small Treasure Chest */}
          <div className="absolute left-[33%] bottom-12 h-12 w-18 rotate-3 rounded-md border border-amber-500/40 bg-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.3)] backdrop-blur-sm">
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-amber-500/70" />
          </div>

          {/* Center Right Small Treasure Chest */}
          <div className="absolute right-[33%] bottom-10 h-12 w-20 -rotate-3 rounded-md border border-cyan-300/40 bg-cyan-700/30 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-sm">
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-cyan-300/70" />
          </div>

          {/* Right Treasure Chest Cluster 1 */}
          <div className="wl-chest-body absolute right-[10%] bottom-14 h-22 w-36 rounded-xl border backdrop-blur-sm">
            <div className="absolute -top-3 left-1/2 h-4 w-32 -translate-x-1/2 rounded-t-lg border-t border-amber-500/60 bg-amber-500/30" />
            <div className="absolute inset-x-0 top-1/2 h-1 bg-amber-500/40" />
            <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-500/80 bg-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
          </div>

          {/* Right Treasure Chest Cluster 2 */}
          <div className="absolute right-[22%] bottom-8 h-16 w-24 rotate-12 rounded-lg border border-cyan-400/50 bg-gradient-to-b from-cyan-600/40 to-cyan-950/80 shadow-[0_0_30px_rgba(6,182,212,0.4)] backdrop-blur-sm">
            <div className="absolute inset-x-0 top-1/2 h-1 bg-cyan-300/40" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-cyan-300/80 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </div>

          {/* Central Underwater Glow Anchor */}
          <div className="absolute left-1/2 bottom-2 h-48 w-[600px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[80px]" />
        </motion.div>
      </motion.div>

      <OceanNav
        onSearch={setQuery}
        onOpenNotifications={() => setNotifOpen(true)}
        searchResults={searchResults}
        onSelectSearchResult={selectTrack}
      />

      {/* Weekly Challenge trigger - centered just below the nav bar.
          Logged-out/guest visitors never see it at all (and so can never
          open the panel behind it) - challenges are a logged-in feature. */}
      {isLoggedIn && (
        <div className="pointer-events-none absolute inset-x-0 top-36 z-20 flex justify-center px-4 sm:top-28">
          <div className="pointer-events-auto">
            <WeeklyChallengeButton isOpen={challengeOpen} onOpen={() => setChallengeOpen(true)} />
          </div>
        </div>
      )}

      {hoveredGroup && (
        <div className="pointer-events-none absolute left-1/2 top-48 z-20 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-wl-bg/90 px-4 py-1.5 text-xs font-medium text-wl-title sm:top-40">
          {hoveredGroup.trackName} — {hoveredGroup.artist}
        </div>
      )}

      {isEmpty && (
        <p className="pointer-events-none absolute left-1/2 top-1/3 z-10 max-w-xs -translate-x-1/2 text-center text-sm text-wl-muted">
          No one's listening yet — play something on Spotify to start a wave.
        </p>
      )}

      <OceanSongPanel group={selectedGroup} myTrackId={myTrackId} onClose={() => setSelectedTrackId(null)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <WeeklyChallengePanel open={challengeOpen} onClose={() => setChallengeOpen(false)} />
      <GuestWelcome />
    </div>
  );
}
