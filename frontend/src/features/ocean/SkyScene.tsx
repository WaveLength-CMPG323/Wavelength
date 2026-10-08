import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTheme } from '../../data/ThemeContext';
import './SkyScene.css';

// The sky behind the ocean canvas. The canvas only paints the sea + waves;
// everything above the horizon -- gradient, sun/moon, clouds, birds, stars --
// lives here as plain DOM/CSS so it animates for free and the theme switch
// can be choreographed purely through a `data-night` attribute.

// Seeded PRNG so the constellation is the same on every load/re-render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260401);
const STARS = Array.from({ length: 110 }, () => ({
  x: rand() * 100,
  y: rand() * 58, // stay above the waves
  size: 1 + rand() * 1.8,
  opacity: 0.45 + rand() * 0.55,
  twinkle: 2 + rand() * 4, // s
  twinkleDelay: -rand() * 5, // s
  appearDelay: 0.35 + rand() * 1.1, // s, only used when night falls
}));

// top = % of the viewport, scale = size, dur = seconds to cross the screen,
// at = how far through the crossing it starts (so they're already spread out)
const CLOUDS = [
  { top: 9, scale: 1.25, dur: 150, at: 0.12, opacity: 0.95 },
  { top: 21, scale: 0.8, dur: 105, at: 0.55, opacity: 0.85 },
  { top: 33, scale: 1.5, dur: 170, at: 0.33, opacity: 0.9 },
  { top: 15, scale: 0.6, dur: 90, at: 0.82, opacity: 0.75 },
  { top: 40, scale: 0.95, dur: 130, at: 0.72, opacity: 0.8 },
  { top: 27, scale: 1.05, dur: 120, at: 0.95, opacity: 0.88 },
];

const BIRDS = [
  { top: 18, size: 30, dur: 34, at: 0.1, flap: 0.55, dir: 'right' },
  { top: 21, size: 22, dur: 34, at: 0.065, flap: 0.5, dir: 'right' },
  { top: 15, size: 20, dur: 34, at: 0.04, flap: 0.6, dir: 'right' },
  { top: 31, size: 26, dur: 46, at: 0.6, flap: 0.65, dir: 'left' },
  { top: 36, size: 18, dur: 52, at: 0.9, flap: 0.5, dir: 'right' },
];

function Cloud() {
  return (
    <svg viewBox="0 0 220 90" className="h-full w-full" fill="currentColor">
      <ellipse cx="62" cy="58" rx="52" ry="26" />
      <ellipse cx="112" cy="40" rx="46" ry="34" />
      <ellipse cx="160" cy="56" rx="48" ry="26" />
      <rect x="58" y="56" width="104" height="28" rx="14" />
    </svg>
  );
}

function Bird({ flap }: { flap: number }) {
  return (
    <svg viewBox="0 0 40 20" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path className="wing wing-l" style={{ animationDuration: `${flap}s` }} d="M20 12 Q12 3 2 8" />
      <path className="wing wing-r" style={{ animationDuration: `${flap}s` }} d="M20 12 Q28 3 38 8" />
    </svg>
  );
}

export default function SkyScene() {
  const { isDark } = useTheme();

  // Each *change* of theme replays the dusk/dawn glow. Not on first mount.
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((p) => p + 1);
  }, [isDark]);

  return (
    <div className="sky" data-night={isDark} aria-hidden="true">
      <div className="sky-bg sky-bg-day" />
      <div className="sky-bg sky-bg-night" />

      {/* stars + shooting stars (night) */}
      <div className="sky-night-fx">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="star"
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                '--size': `${s.size}px`,
                '--o': s.opacity,
                '--appear': `${s.appearDelay}s`,
              } as CSSProperties
            }
          >
            <i style={{ animationDuration: `${s.twinkle}s`, animationDelay: `${s.twinkleDelay}s` }} />
          </span>
        ))}
        <span className="shooting" style={{ left: '78%', top: '9%', animationDelay: '2.5s' }} />
        <span className="shooting" style={{ left: '55%', top: '20%', animationDelay: '8s', animationDuration: '17s' }} />
      </div>

      {/* sunrise / sunset flare along the horizon, replayed on every switch */}
      {pulse > 0 && <div key={pulse} className="sky-glow" />}

      {/* sun and moon share one orbit: one sets while the other rises */}
      <div className="celestial sun">
        <div className="sun-rays" />
        <div className="sun-core" />
      </div>
      <div className="celestial moon">
        <div className="moon-core">
          <i style={{ left: '22%', top: '30%', width: '22%', height: '22%' }} />
          <i style={{ left: '56%', top: '18%', width: '14%', height: '14%' }} />
          <i style={{ left: '48%', top: '58%', width: '26%', height: '26%' }} />
          <i style={{ left: '16%', top: '66%', width: '12%', height: '12%' }} />
        </div>
      </div>

      {/* clouds + birds (day) */}
      <div className="sky-day-fx">
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            className="cloud"
            style={{
              top: `${c.top}%`,
              width: `${220 * c.scale}px`,
              height: `${90 * c.scale}px`,
              opacity: c.opacity,
              animationDuration: `${c.dur}s`,
              animationDelay: `${-c.at * c.dur}s`,
            }}
          >
            <Cloud />
          </div>
        ))}
        {BIRDS.map((b, i) => (
          <div
            key={i}
            className={`bird bird-${b.dir}`}
            style={{
              top: `${b.top}%`,
              width: `${b.size}px`,
              height: `${b.size / 2}px`,
              animationDuration: `${b.dur}s`,
              animationDelay: `${-b.at * b.dur}s`,
            }}
          >
            <div className="bird-bob" style={{ animationDelay: `${-i * 0.9}s` }}>
              <Bird flap={b.flap} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
