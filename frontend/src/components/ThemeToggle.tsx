import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../data/ThemeContext';

// A tiny sky in a pill: day track with a cloud, night track with stars, and a
// thumb that is the sun or the moon. Flipping it slides the thumb across while
// the sun/moon icons spin past each other and the two skies cross-fade.
const STARS = [
  { x: 9, y: 7, s: 2, d: 0 },
  { x: 17, y: 17, s: 1.5, d: 0.25 },
  { x: 25, y: 6, s: 1.5, d: 0.5 },
  { x: 31, y: 15, s: 2, d: 0.15 },
  { x: 14, y: 23, s: 1.5, d: 0.4 },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`group relative h-8 w-[3.75rem] shrink-0 overflow-hidden rounded-full border border-cyan-500/30 shadow-inner outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-wl-icon ${className}`}
    >
      {/* day sky */}
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: isDark ? 0 : 1, background: 'linear-gradient(180deg,#8fd0f6 0%,#d8efff 100%)' }}
      >
        <span className="absolute right-2 top-[15px] h-2.5 w-5 rounded-full bg-white/90" />
        <span className="absolute right-4 top-[11px] h-3 w-3 rounded-full bg-white/90" />
      </span>

      {/* night sky */}
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: isDark ? 1 : 0, background: 'linear-gradient(180deg,#020617 0%,#0b2347 100%)' }}
      >
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: st.x,
              top: st.y,
              width: st.s,
              height: st.s,
              transform: isDark ? 'scale(1)' : 'scale(0)',
              transition: `transform 0.5s ${isDark ? 0.35 + st.d : 0}s`,
            }}
          />
        ))}
      </span>

      {/* thumb */}
      <span
        aria-hidden="true"
        className="absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow-md"
        style={{
          transform: `translateX(${isDark ? 28 : 0}px) rotate(${isDark ? 360 : 0}deg)`,
          background: isDark ? '#eef0fa' : '#ffd35c',
          transition: 'transform 0.7s cubic-bezier(.34,1.45,.64,1), background-color 0.7s',
          boxShadow: isDark ? '0 0 10px 2px rgba(190,205,255,.45)' : '0 0 12px 3px rgba(255,200,60,.65)',
        }}
      >
        <Sun
          className="absolute h-4 w-4 text-amber-600 transition-all duration-500"
          style={{ opacity: isDark ? 0 : 1, transform: `scale(${isDark ? 0.4 : 1}) rotate(${isDark ? -90 : 0}deg)` }}
        />
        <Moon
          className="absolute h-3.5 w-3.5 text-slate-600 transition-all duration-500"
          style={{ opacity: isDark ? 1 : 0, transform: `scale(${isDark ? 1 : 0.4}) rotate(${isDark ? 0 : 90}deg)` }}
        />
      </span>
    </button>
  );
}
