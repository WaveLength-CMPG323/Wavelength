import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// First-run walkthrough for new users on the Ocean page.
//
// Each step either spotlights a nav element (matched by its
// `data-tour="..."` attribute in OceanNav.tsx) or, with no target, shows a
// centred card (used for the canvas, which has nothing to anchor to).
// To add or reorder steps, just edit STEPS below.
interface Step {
  target?: string; // value of the data-tour attribute to spotlight
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to WaveLength 🌊',
    body: 'Music is better with people. Here’s a 30-second tour of how the ocean works.',
  },
  {
    title: 'The Ocean',
    body: 'Every floating cover is a song someone is listening to right now. The more listeners on a song, the more it’s worth checking out. Click one to see who’s behind it, join in on Spotify, or Follow Along.',
  },
  {
    target: 'search',
    title: 'Search & filter',
    body: 'Looking for a vibe? Type a song or artist to narrow the ocean down to what you want.',
  },
  {
    target: 'profile',
    title: 'Your profile',
    body: 'Your Spotify identity, recent listening and public playlists live here.',
  },
  {
    target: 'chat',
    title: 'Chat',
    body: 'Talk music with people you connect with. You can’t message strangers directly. Chat starts once a request is accepted.',
  },
  {
    target: 'notifications',
    title: 'Notifications',
    body: 'Chat requests from other listeners show up here. A red dot means someone’s waiting for you.',
  },
  {
    target: 'challenge',
    title: 'Weekly Challenge',
    body: 'A new theme every week. No points, no leaderboards, just a fun excuse to share music.',
  },
  {
    title: 'You’re all set!',
    body: 'Dive in, tap a song, and see who’s on your wavelength.',
  },
];

const PAD = 8; // spotlight padding around the target, px
const CARD_W = 340;

interface Rect { top: number; left: number; width: number; height: number }

function measure(target?: string): Rect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface Props {
  open: boolean;
  onClose: (completed: boolean) => void;
}

export default function OceanTutorial({ open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // Always restart from the first step when (re)opened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Track the target's position (and keep it right on resize).
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setRect(measure(step.target));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, step.target]);

  const next = useCallback(() => {
    if (isLast) onClose(true);
    else setIndex((i) => i + 1);
  }, [isLast, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(false);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, back, onClose]);

  const cardW = Math.min(CARD_W, window.innerWidth - 24);
  // Anchored steps sit just below the spotlight (the nav is at the top of
  // the screen); un-anchored steps are centred.
  const cardStyle = rect
    ? {
        top: rect.top + rect.height + PAD + 12,
        left: Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12),
        width: cardW,
      }
    : { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tutorial"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="WaveLength tutorial"
        >
          {/* Click-blocker so the page underneath can't be used mid-tour. */}
          <div className="absolute inset-0" />

          {rect ? (
            <motion.div
              className="pointer-events-none absolute rounded-xl ring-2 ring-cyan-300"
              style={{ boxShadow: '0 0 0 9999px rgba(2, 24, 43, 0.82)' }}
              initial={false}
              animate={{
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-[#02182b]/82" />
          )}

          <motion.div
            key={index}
            className="absolute rounded-2xl border border-cyan-500/30 bg-[#04385a] p-5 text-cyan-50 shadow-2xl"
            style={cardStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => onClose(false)}
              aria-label="Skip tutorial"
              className="absolute right-3 top-3 text-cyan-200/60 hover:text-cyan-100"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="pr-6 text-lg font-bold text-cyan-100">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-100/80">{step.body}</p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex gap-1.5" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-cyan-300' : 'bg-cyan-100/25'}`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1ED760] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#1fdf64]"
                >
                  {isLast ? 'Start exploring' : 'Next'}
                  {!isLast && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {!isLast && (
              <button type="button" onClick={() => onClose(false)} className="mt-3 text-xs text-cyan-200/50 hover:text-cyan-100">
                Skip tour
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---- "has this user seen it?" persistence ---- */
// Bump the version suffix to show the tour again to everyone after a big UI change.
const SEEN_KEY = 'wavelength.tutorial.v1';

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'done';
  } catch {
    return true; // storage blocked: don't nag on every load
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'done');
  } catch {
    // ignore
  }
}

export function resetTutorialSeen(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
}
