import SkyScene from '../features/ocean/SkyScene';

// Shared decorative "alive" backdrop for any page that wants the Ocean
// page's atmosphere (sun/moon/clouds/birds/stars + drifting wave bands +
// rising bubbles) without the full interactive canvas. Built by combining
// three pieces that already existed elsewhere in the app rather than
// inventing new animation:
//   - SkyScene (self-contained, theme-aware via useTheme() internally).
//   - The wave-band SVG treatment from LoginPage.tsx, using the exact same
//     `.login-wave-band` / `.login-wave-band-N` classes (and their
//     `@keyframes login-wave-drift`) defined once in index.css - this
//     component only supplies its own markup/viewBox, not new keyframes.
//   - The rising-bubbles layer, same approach with `.login-bubble` /
//     `@keyframes login-bubble-rise`.
//
// Purely decorative: pointer-events-none, absolutely fills its parent
// (inset-0). The consuming page is responsible for its own `relative` +
// `overflow-hidden` wrapper and for stacking real content above this with
// `relative z-10`, same pattern the Ocean/Chat/Profile pages already use.
export default function OceanBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Sun/moon/clouds/birds/stars - already a full self-contained layer */}
      <SkyScene />

      {/* Rising bubbles, same treatment as the Login page. */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="login-bubble"
            style={{
              left: `${(i * 59.3) % 100}%`,
              width: `${4 + (i % 4) * 3}px`,
              height: `${4 + (i % 4) * 3}px`,
              animationDuration: `${9 + (i % 6) * 2}s`,
              animationDelay: `${-(i * 1.9)}s`,
            }}
          />
        ))}
      </div>

      {/* Layered drifting wave bands along the bottom edge - same shape
          and drift animation as the Login page, contained within its own
          overflow-hidden strip so the horizontal drift never causes page
          scroll. "slice" scales the pattern up uniformly to guarantee full
          width coverage instead of ever leaving a bare gap at the edges. */}
      <div className="absolute inset-x-0 bottom-0 h-[34vh] min-h-[160px] w-full overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 2400 300"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <path
              id="wl-backdrop-wave-shape"
              d="M0 90c150 0 150 60 300 60s150-60 300-60 150 60 300 60 150-60 300-60 150 60 300 60 150-60 300-60 150 60 300 60 150-60 300-60v210H0z"
            />
          </defs>
          <g className="login-wave-band login-wave-band-1 text-wl-icon/12">
            <use href="#wl-backdrop-wave-shape" fill="currentColor" />
          </g>
          <g className="login-wave-band login-wave-band-2 text-wl-icon/22">
            <use href="#wl-backdrop-wave-shape" x="60" y="40" fill="currentColor" />
          </g>
          <g className="login-wave-band login-wave-band-3 text-wl-icon/38">
            <use href="#wl-backdrop-wave-shape" x="-40" y="80" fill="currentColor" />
          </g>
        </svg>
      </div>
    </div>
  );
}
