import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  LogIn,
  LogOut,
  MessageCircle,
  Search,
  Trophy,
} from 'lucide-react';

import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';

interface Props {
  onSearch: (query: string) => void;
  onOpenNotifications: () => void;
  onOpenChallenge: () => void;
  isChallengeOpen?: boolean;
}

export default function OceanNav({
  onSearch,
  onOpenNotifications,
  onOpenChallenge,
  isChallengeOpen = false,
}: Props) {
  const { db } = useData();
  const { isLoggedIn, logout } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDiving, setIsDiving] = useState(false);
  const [isResurfacing, setIsResurfacing] = useState(false);
  const [splashKey, setSplashKey] = useState(0);

  const prevChallengeOpen = useRef(isChallengeOpen);

  const pendingCount = db.notifications.filter(
    (notification) => notification.status === 'pending'
  ).length;

  // Detect when the Challenge Panel closes to trigger the "Resurfacing" animation from the ocean
  useEffect(() => {
    if (prevChallengeOpen.current && !isChallengeOpen) {
      setIsResurfacing(true);
      setSplashKey((prev) => prev + 1);
      const timer = setTimeout(() => {
        setIsResurfacing(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
    prevChallengeOpen.current = isChallengeOpen;
  }, [isChallengeOpen]);

  const handleFlip = (state: boolean) => {
    setIsFlipped(state);
    setSplashKey((prev) => prev + 1);
  };

  const handleClickChallenge = () => {
    setIsDiving(true);
    setTimeout(() => {
      onOpenChallenge();
      setIsDiving(false);
    }, 750);
  };

  const splashDroplets = [
    { id: 1, x: -50, y: -35, scale: 0.9, delay: 0 },
    { id: 2, x: 50, y: -40, scale: 0.8, delay: 0.02 },
    { id: 3, x: -30, y: -50, scale: 1.1, delay: 0.04 },
    { id: 4, x: 30, y: -45, scale: 1.0, delay: 0.01 },
    { id: 5, x: -60, y: -10, scale: 0.7, delay: 0.05 },
    { id: 6, x: 60, y: -15, scale: 0.85, delay: 0.03 },
    { id: 7, x: -15, y: -55, scale: 1.2, delay: 0.02 },
    { id: 8, x: 15, y: -58, scale: 0.95, delay: 0.04 },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-5 pt-4">
      <div
        className="
          mx-auto flex min-h-16 w-full
          flex-wrap items-center gap-x-4 gap-y-2
          rounded-2xl border border-cyan-400/20
          bg-[#071330]/40 px-5 py-3
          text-white
          shadow-[0_12px_40px_rgba(2,10,25,0.4)]
          backdrop-blur-xl
        "
      >
        {/* LEFT — WaveLength branding */}
        <Link
          to="/"
          aria-label="WaveLength home"
          className="flex shrink-0 items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-300/30 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="block">
            <p className="text-base font-semibold tracking-wide text-white">
              WaveLength
            </p>
            <p className="text-[11px] text-cyan-200/60">Discover your sound</p>
          </div>
        </Link>

        {/* LEFT — Navigation with Diving & Resurfacing Ocean Buoy */}
        <div className="flex items-center">
          {isLoggedIn && (
            <nav className="flex items-center justify-center gap-2">
              <Link
                to="/chat"
                aria-label="Chat"
                className="
                  relative flex items-center gap-2
                  rounded-full px-3 py-2
                  text-sm font-medium text-cyan-100/80
                  transition
                  hover:bg-cyan-500/10 hover:text-white
                "
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">Chat</span>
                {db.hasChatDot && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-[#071330]" />
                )}
              </Link>

              <button
                type="button"
                aria-label="Notifications"
                onClick={onOpenNotifications}
                className="
                  relative flex items-center gap-2
                  rounded-full px-3 py-2
                  text-sm font-medium text-cyan-100/80
                  transition
                  hover:bg-cyan-500/10 hover:text-white
                "
              >
                <Bell className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">Notifications</span>
                {pendingCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-[#071330]" />
                )}
              </button>

              {/* OCEAN BUOY BUTTON CONTAINER */}
              <div
                className="relative flex items-center justify-center [perspective:1000px]"
                onMouseEnter={() => handleFlip(true)}
                onMouseLeave={() => handleFlip(false)}
              >
                {/* EXPLOSIVE SPLASH PARTICLES */}
                <AnimatePresence>
                  <div
                    key={splashKey}
                    className="absolute pointer-events-none inset-0 flex items-center justify-center"
                  >
                    {splashDroplets.map((d) => (
                      <motion.span
                        key={d.id}
                        initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                        animate={{
                          x: d.x,
                          y: d.y,
                          scale: [0, d.scale, 0],
                          opacity: [1, 0.9, 0],
                        }}
                        transition={{
                          duration: 0.6,
                          delay: d.delay,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className="absolute h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-cyan-300 via-sky-100 to-white shadow-[0_0_8px_#38bdf8]"
                      />
                    ))}
                  </div>
                </AnimatePresence>

                {/* ANIMATION ENGINE: DIVING DOWN ON CLICK & RESURFACING FROM OCEAN ON CLOSE */}
                <motion.div
                  animate={
                    isDiving
                      ? {
                          y: [0, -6, 160],
                          scale: [1, 1.05, 0.3],
                          opacity: [1, 0.8, 0],
                        }
                      : isResurfacing
                      ? {
                          y: [160, -12, 0],
                          scale: [0.3, 1.1, 1],
                          opacity: [0, 1, 1],
                        }
                      : {
                          y: [0, -3, 2, -1, 0],
                          rotateZ: [0, 1, -1, 0],
                        }
                  }
                  transition={
                    isDiving
                      ? { duration: 0.7, ease: 'easeIn' }
                      : isResurfacing
                      ? { duration: 0.85, ease: [0.175, 0.885, 0.32, 1.275] }
                      : { repeat: Infinity, duration: 4.5, ease: 'easeInOut' }
                  }
                  className="relative"
                >
                  <button
                    type="button"
                    aria-label="Weekly Challenge"
                    onClick={handleClickChallenge}
                    className="
                      relative h-10 w-48 overflow-hidden rounded-full p-[1px]
                      shadow-[0_4px_20px_rgba(6,182,212,0.35)]
                      hover:shadow-[0_8px_30px_rgba(56,189,248,0.6)]
                      transition-shadow duration-300
                    "
                  >
                    <motion.div
                      className="relative h-full w-full [transform-style:preserve-3d]"
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    >
                      {/* FRONT FACE — RIDE THE WAVE */}
                      <div
                        className="
                          absolute inset-0 flex h-full w-full items-center justify-between
                          rounded-full bg-gradient-to-r from-cyan-900/95 via-blue-900/95 to-slate-950/95
                          px-4 border border-cyan-400/30 backdrop-blur-md
                          [backface-visibility:hidden]
                        "
                      >
                        <div className="relative z-10 flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: [-6, 6, -6] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 border border-cyan-300/40"
                          >
                            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-cyan-200" strokeWidth="2.5">
                              <path d="M2 14c3-4 6-4 9 0s6 4 9 0" />
                            </svg>
                          </motion.div>
                          <span className="font-bold text-xs tracking-wider text-cyan-100">
                            RIDE THE WAVE
                          </span>
                        </div>

                        <span className="relative z-10 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                        </span>
                      </div>

                      {/* BACK FACE — WEEKLY CHALLENGES */}
                      <div
                        className="
                          absolute inset-0 flex h-full w-full items-center justify-center gap-2
                          rounded-full bg-gradient-to-r from-sky-950 via-teal-900 to-cyan-950
                          px-3 border border-teal-300/50 backdrop-blur-md
                          [backface-visibility:hidden] [transform:rotateY(180deg)]
                        "
                      >
                        <Trophy className="h-4 w-4 text-cyan-300 drop-shadow-[0_0_6px_#22d3ee]" />
                        <span className="font-extrabold text-[11px] tracking-wide text-cyan-100">
                          WEEKLY CHALLENGES
                        </span>
                        <div className="rounded-full bg-cyan-400/20 border border-cyan-300/40 px-1.5 py-0.5 text-[8px] font-black text-cyan-200 tracking-wider">
                          GO
                        </div>
                      </div>
                    </motion.div>
                  </button>
                </motion.div>
              </div>
            </nav>
          )}
        </div>

        {/* RIGHT — Search + account */}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
          <div
            className="
              flex min-w-0 items-center gap-2
              rounded-full border border-cyan-400/20
              bg-[#050e26]/60 px-3 py-2
              transition
              focus-within:border-cyan-400/50
              focus-within:bg-[#050e26]/80
              xl:px-4
            "
          >
            <Search className="h-4 w-4 shrink-0 text-cyan-300" />
            <input
              type="text"
              placeholder="Search songs or artists"
              aria-label="Search songs or artists"
              onChange={(e) => onSearch(e.target.value)}
              className="
                w-24 min-w-0 bg-transparent text-sm text-white
                outline-none placeholder:text-cyan-200/40
                lg:w-32 xl:w-48
              "
            />
          </div>

          {isLoggedIn ? (
            <>
              <Link to="/profile" aria-label="Your profile" className="shrink-0">
                <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-cyan-300/50 bg-white/10 transition hover:border-cyan-200">
                  {db.me.pic ? (
                    <img src={db.me.pic} alt="Your profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                      ME
                    </span>
                  )}
                </span>
              </Link>

              <button
                onClick={logout}
                type="button"
                aria-label="Log out"
                className="
                  flex shrink-0 items-center gap-2
                  rounded-full px-2 py-2
                  text-sm font-medium text-cyan-100/70
                  transition hover:bg-cyan-500/10 hover:text-white
                  xl:px-3
                "
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">Log out</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex shrink-0 items-center gap-2 rounded-full bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#071330] shadow-sm transition hover:bg-cyan-300 xl:px-4"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Log in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}