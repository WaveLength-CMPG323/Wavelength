import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onOpen: () => void;
}

// The Weekly Challenge trigger button - visual design and animation ported
// verbatim from the redesigned mockup's OceanNav "Ocean Buoy" button
// (front/back flip on hover, splash droplets, dive-down-on-click /
// resurface-on-close). Pulled out of OceanNav here so it can live as its
// own top-center element on the page instead of inside the icon row, per
// request - it's still wired to the current project's real
// WeeklyChallengePanel open/close state via the isOpen/onOpen props.
export default function WeeklyChallengeButton({ isOpen, onOpen }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDiving, setIsDiving] = useState(false);
  const [isResurfacing, setIsResurfacing] = useState(false);
  const [splashKey, setSplashKey] = useState(0);

  const prevOpen = useRef(isOpen);

  // Detect when the Challenge Panel closes to trigger the "Resurfacing"
  // animation from the ocean (the panel can close itself, e.g. via its own
  // close button, not just via this button).
  useEffect(() => {
    if (prevOpen.current && !isOpen) {
      setIsResurfacing(true);
      setSplashKey((prev) => prev + 1);
      const timer = setTimeout(() => setIsResurfacing(false), 1000);
      return () => clearTimeout(timer);
    }
    prevOpen.current = isOpen;
  }, [isOpen]);

  function handleFlip(state: boolean) {
    setIsFlipped(state);
    setSplashKey((prev) => prev + 1);
  }

  function handleClick() {
    setIsDiving(true);
    setTimeout(() => {
      onOpen();
      setIsDiving(false);
    }, 750);
  }

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
    <div
      className="relative flex items-center justify-center [perspective:1000px]"
      onMouseEnter={() => handleFlip(true)}
      onMouseLeave={() => handleFlip(false)}
    >
      {/* EXPLOSIVE SPLASH PARTICLES */}
      <AnimatePresence>
        <div key={splashKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
              transition={{ duration: 0.6, delay: d.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-cyan-300 via-sky-100 to-white shadow-[0_0_8px_#38bdf8]"
            />
          ))}
        </div>
      </AnimatePresence>

      {/* ANIMATION ENGINE: DIVING DOWN ON CLICK & RESURFACING FROM OCEAN ON CLOSE */}
      <motion.div
        animate={
          isDiving
            ? { y: [0, -6, 160], scale: [1, 1.05, 0.3], opacity: [1, 0.8, 0] }
            : isResurfacing
              ? { y: [160, -12, 0], scale: [0.3, 1.1, 1], opacity: [0, 1, 1] }
              : { y: [0, -3, 2, -1, 0], rotateZ: [0, 1, -1, 0] }
        }
        transition={
          isDiving
            ? { duration: 0.7, ease: 'easeIn' }
            : isResurfacing
              ? { duration: 0.85, ease: [0.175, 0.885, 0.32, 1.275] }
              // Slowed ~1.6x from the original 4.5s so the idle "buoy" bob
              // reads as calm rather than restless - shared with the other
              // nav buttons' bob in OceanNav.tsx.
              : { repeat: Infinity, duration: 7.2, ease: 'easeInOut' }
        }
        className="relative"
      >
        <button
          type="button"
          aria-label="Weekly Challenge"
          onClick={handleClick}
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
                <span className="font-bold text-xs tracking-wider text-cyan-100">RIDE THE WAVE</span>
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
              <span className="font-extrabold text-[11px] tracking-wide text-cyan-100">WEEKLY CHALLENGES</span>
              <div className="rounded-full bg-cyan-400/20 border border-cyan-300/40 px-1.5 py-0.5 text-[8px] font-black text-cyan-200 tracking-wider">
                GO
              </div>
            </div>
          </motion.div>
        </button>
      </motion.div>
    </div>
  );
}
