import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';
import OceanNav from './OceanNav';
import { useOceanCanvas, type OceanMarker } from './useOceanCanvas';
import SongDetailsPanel from '../song-details/SongDetailsPanel';
import NotificationsPanel from '../notifications/NotificationsPanel';
import WeeklyChallengePanel from '../challenges/WeeklyChallengePanel';
import PlayerBar from '../player/PlayerBar';

export default function OceanPage() {
  const { db } = useData();
  const { isLoggedIn } = useAuth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<string | null>(params.get('song'));
  const [notifOpen, setNotifOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const markers: OceanMarker[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.floaterOrder
      .map((id) => db.songs[id])
      .filter(Boolean)
      .filter((song) => q === '' || song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q))
      .map((song) => ({ id: song.id, song, isMine: song.ownerId === 'me' }));
  }, [db.floaterOrder, db.songs, query]);

  const { canvasRef, containerRef, hoveredId } = useOceanCanvas({
    markers,
    onSelect: setSelectedSong,
    imageResolver: (song) => song.cover,
  });

  const hoveredSong = hoveredId ? db.songs[hoveredId] : null;

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden">
      <canvas ref={canvasRef} className={`absolute inset-0 ${hoveredId ? 'cursor-pointer' : 'cursor-default'}`} />

      <OceanNav
        onSearch={setQuery}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenChallenge={() => setChallengeOpen(true)}
      />

      {hoveredSong && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-[#02182b]/90 px-4 py-1.5 text-xs font-medium text-cyan-100">
          {hoveredSong.title} — {hoveredSong.artist}
        </div>
      )}

      {/* Guests just see the ocean -- playback controls appear once logged in. */}
      {isLoggedIn && <PlayerBar queue={markers.map((m) => m.song)} />}

      <SongDetailsPanel songId={selectedSong} onClose={() => setSelectedSong(null)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <WeeklyChallengePanel open={challengeOpen} onClose={() => setChallengeOpen(false)} />
    </div>
  );
}
