import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../data/DataContext';
import OceanNav from './OceanNav';
import { useOceanCanvas, type OceanMarker } from './useOceanCanvas';
import SongDetailsPanel from '../song-details/SongDetailsPanel';
import NotificationsPanel from '../notifications/NotificationsPanel';
import WeeklyChallengePanel from '../challenges/WeeklyChallengePanel';

export default function OceanPage() {
  const { db } = useData();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<string | null>(
    params.get('song')
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const markers: OceanMarker[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    return db.floaterOrder
      .map((id) => db.songs[id])
      .filter(Boolean)
      .filter(
        (song) =>
          q === '' ||
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q)
      )
      .map((song) => ({
        id: song.id,
        song,
        isMine: song.ownerId === 'me',
      }));
  }, [db.floaterOrder, db.songs, query]);

  const { canvasRef, containerRef, hoveredId } = useOceanCanvas({
    markers,
    onSelect: setSelectedSong,
    imageResolver: (song) => song.cover,
  });

  const hoveredSong = hoveredId ? db.songs[hoveredId] : null;

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden"
    >
      {/* 🌊 OCEAN VIEWPORT LAYER: Retains original layout, translates down when Ride the Wave is open */}
      <motion.div
        className="relative h-full w-full"
        animate={{
          y: challengeOpen ? '-30%' : '0%', // Dives down into seabed, ascends back up to top on close
        }}
        transition={{
          duration: 1.1,
          ease: [0.16, 1, 0.3, 1], // Smooth dive physics
        }}
      >
        {/* ORIGINAL OCEAN CANVAS */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-0 ${
            hoveredId ? 'cursor-pointer' : 'cursor-default'
          }`}
        />

        {/* ABYSSAL SEABED OVERLAY LAYER (Only visible during Dive mode) */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 -bottom-[30vh] z-10 h-[50vh] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: challengeOpen ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Deep seabed gradient transition */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#01050d] via-[#020f24]/80 to-transparent" />

          {/* Treasure glow effect at bottom */}
          <div className="absolute left-1/2 bottom-0 h-80 w-[600px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[100px]" />
        </motion.div>
      </motion.div>

      {/* TOP NAVBAR (Stays anchored on top) */}
      <OceanNav
        onSearch={setQuery}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenChallenge={() => setChallengeOpen(true)}
        isChallengeOpen={challengeOpen}
      />

      {/* HOVER TOOLTIP */}
      {hoveredSong && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-[#02182b]/90 px-4 py-1.5 text-xs font-medium text-cyan-100 shadow-md">
          {hoveredSong.title} — {hoveredSong.artist}
        </div>
      )}

      {/* SIDE/POPUP PANELS */}
      <SongDetailsPanel
        songId={selectedSong}
        onClose={() => setSelectedSong(null)}
      />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />

      <AnimatePresence>
        {challengeOpen && (
          <WeeklyChallengePanel
            open={challengeOpen}
            onClose={() => setChallengeOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}