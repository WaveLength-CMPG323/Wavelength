import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../data/AuthContext';
import OceanNav from './OceanNav';
import { useOceanCanvas, type OceanMarker } from './useOceanCanvas';
import OceanSongPanel from './OceanSongPanel';
import NotificationsPanel from '../notifications/NotificationsPanel';
import WeeklyChallengePanel from '../challenges/WeeklyChallengePanel';
import { getSocket } from '../../lib/socket';
import { fetchCurrentlyPlaying } from '../../lib/api';
import type { OceanGroup } from '../../data/types';

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

  // Whatever track I'M personally listening to right now (playing or
  // paused) - mirrors the backend's own test dashboard's pollMyStatus(),
  // so "Join"/bubble highlighting stays accurate even while paused.
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
    async function poll() {
      try {
        const data = await fetchCurrentlyPlaying();
        if (!cancelled) setMyTrackId(data.trackId ?? null);
      } catch {
        // non-fatal - keep the last known value until the next poll succeeds
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
    const q = query.trim().toLowerCase();
    return Object.values(groups)
      .filter((g) => q === '' || g.trackName.toLowerCase().includes(q) || g.artist.toLowerCase().includes(q))
      .map((g) => ({
        id: g.trackId,
        song: { id: g.trackId, title: g.trackName, artist: g.artist, cover: g.albumArt, ownerId: g.hostSessionId },
        isMine: g.trackId === myTrackId,
        listenerCount: g.listenerCount,
      }));
  }, [groups, query, myTrackId]);

  const { canvasRef, containerRef, hoveredId } = useOceanCanvas({
    markers,
    // Guests can watch the ocean, but every interaction (join, follow,
    // even just opening a song's details) requires a real Spotify login -
    // send them to /login instead of opening the panel.
    onSelect: (trackId) => {
      if (!isLoggedIn) {
        navigate('/login');
        return;
      }
      setSelectedTrackId(trackId);
    },
    imageResolver: (song) => song.cover,
  });

  const hoveredGroup = hoveredId ? (groups[hoveredId] ?? null) : null;
  const selectedGroup = selectedTrackId ? (groups[selectedTrackId] ?? null) : null;
  const isEmpty = Object.keys(groups).length === 0;

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden">
      <canvas ref={canvasRef} className={`absolute inset-0 ${hoveredId ? 'cursor-pointer' : 'cursor-default'}`} />

      <OceanNav
        onSearch={setQuery}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenChallenge={() => setChallengeOpen(true)}
      />

      {hoveredGroup && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-[#02182b]/90 px-4 py-1.5 text-xs font-medium text-cyan-100">
          {hoveredGroup.trackName} — {hoveredGroup.artist}
        </div>
      )}

      {isEmpty && (
        <p className="pointer-events-none absolute left-1/2 top-1/3 z-10 max-w-xs -translate-x-1/2 text-center text-sm text-cyan-100/60">
          No one's listening yet — play something on Spotify to start a wave.
        </p>
      )}

      <OceanSongPanel group={selectedGroup} myTrackId={myTrackId} onClose={() => setSelectedTrackId(null)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <WeeklyChallengePanel open={challengeOpen} onClose={() => setChallengeOpen(false)} />
    </div>
  );
}
