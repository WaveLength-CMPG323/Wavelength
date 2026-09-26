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
      className="relative h-screen w-full overflow-hidden bg-[#0a192f]"
    >
      {/* Ocean Viewport and Seabed Dive Layer */}
      <motion.div
        className="relative h-full w-full"
        animate={{
          y: challengeOpen ? '-25%' : '0%',
        }}
        transition={{
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {/* Original Surface Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-0 ${
            hoveredId ? 'cursor-pointer' : 'cursor-default'
          }`}
        />

        {/* Underwater Seabed and Treasure Environment Overlay */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 -bottom-[35vh] z-10 h-[60vh] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: challengeOpen ? 1 : 0 }}
          transition={{ duration: 0.9 }}
        >
          {/* Deep Seabed Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020712] via-[#051329]/90 to-transparent" />

          {/* Caustic Light Rays */}
          <div className="absolute left-1/2 top-0 h-[450px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
          <div className="absolute left-[20%] top-10 h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[80px]" />
          <div className="absolute right-[20%] top-10 h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[80px]" />

          {/* Ocean Floor Ridge Line */}
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#01040a] to-transparent opacity-90" />

          {/* Left Treasure Chest Cluster 1 */}
          <div className="absolute left-[8%] bottom-16 h-20 w-32 rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-600/40 via-amber-900/60 to-amber-950/80 shadow-[0_0_35px_rgba(245,158,11,0.4)] backdrop-blur-sm">
            <div className="absolute -top-3 left-1/2 h-4 w-28 -translate-x-1/2 rounded-t-lg border-t border-amber-300/60 bg-amber-500/30" />
            <div className="absolute inset-x-0 top-1/2 h-1 bg-amber-400/40" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-300/80 bg-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          </div>

          {/* Left Treasure Chest Cluster 2 (Smaller & Tilted) */}
          <div className="absolute left-[18%] bottom-10 h-14 w-22 -rotate-6 rounded-lg border border-cyan-400/50 bg-gradient-to-b from-cyan-600/40 to-cyan-950/80 shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-sm">
            <div className="absolute inset-x-0 top-1/2 h-1 bg-cyan-300/40" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-cyan-300/80 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </div>

          {/* Center Left Small Treasure Chest */}
          <div className="absolute left-[33%] bottom-12 h-12 w-18 rotate-3 rounded-md border border-amber-300/40 bg-amber-700/30 shadow-[0_0_20px_rgba(245,158,11,0.3)] backdrop-blur-sm">
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-amber-300/70" />
          </div>

          {/* Center Right Small Treasure Chest */}
          <div className="absolute right-[33%] bottom-10 h-12 w-20 -rotate-3 rounded-md border border-cyan-300/40 bg-cyan-700/30 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-sm">
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-cyan-300/70" />
          </div>

          {/* Right Treasure Chest Cluster 1 */}
          <div className="absolute right-[10%] bottom-14 h-22 w-36 rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-600/40 via-amber-900/60 to-amber-950/80 shadow-[0_0_40px_rgba(245,158,11,0.4)] backdrop-blur-sm">
            <div className="absolute -top-3 left-1/2 h-4 w-32 -translate-x-1/2 rounded-t-lg border-t border-amber-300/60 bg-amber-500/30" />
            <div className="absolute inset-x-0 top-1/2 h-1 bg-amber-400/40" />
            <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-300/80 bg-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
          </div>

          {/* Right Treasure Chest Cluster 2 */}
          <div className="absolute right-[22%] bottom-8 h-16 w-24 rotate-12 rounded-lg border border-cyan-400/50 bg-gradient-to-b from-cyan-600/40 to-cyan-950/80 shadow-[0_0_30px_rgba(6,182,212,0.4)] backdrop-blur-sm">
            <div className="absolute inset-x-0 top-1/2 h-1 bg-cyan-300/40" />
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-cyan-300/80 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </div>

          {/* Central Underwater Glow Anchor */}
          <div className="absolute left-1/2 bottom-2 h-48 w-[600px] -translate-x-1/2 rounded-full bg-amber-400/10 blur-[80px]" />
        </motion.div>
      </motion.div>

      {/* Top Navbar */}
      <OceanNav
        onSearch={setQuery}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenChallenge={() => setChallengeOpen(true)}
        isChallengeOpen={challengeOpen}
      />

      {/* Hover Tooltip */}
      {hoveredSong && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-[#02182b]/90 px-4 py-1.5 text-xs font-medium text-cyan-100 shadow-md">
          {hoveredSong.title} — {hoveredSong.artist}
        </div>
      )}

      {/* Side and Popup Panels */}
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