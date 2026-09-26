/**
 * Decorative wave band — the same "gentle-wave" path and layered look as
 * wavelength_login.css, recoloured to the three brand shades. Animation is
 * plain CSS (see the wl-wave-layer/wl-wave-drift rules in index.css), the
 * same mechanism the login page itself uses, rather than a JS-driven one.
 *
 * Positioned with `absolute` inside the app's (relatively positioned) root,
 * not `fixed`, and given a negative z-index — that guarantees it paints
 * behind ordinary in-flow content regardless of whether that content is
 * itself positioned, so nothing else needs an explicit z-index to sit
 * above it.
 */
export function WaveBackground() {
  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[32vh] min-h-[160px] max-h-[300px] overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 24 150 28"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <path id="wl-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
        </defs>
        {/* Painted back to front: faint cobalt, then azure, then the brightest sky layer on top. */}
        <use className="wl-wave-layer" href="#wl-wave" x="48" y="6" fill="var(--color-brand-cobalt)" fillOpacity={0.4} />
        <use className="wl-wave-layer" href="#wl-wave" x="48" y="3" fill="var(--color-brand-azure)" fillOpacity={0.65} />
        <use className="wl-wave-layer" href="#wl-wave" x="48" y="0" fill="var(--color-brand-sky)" fillOpacity={0.9} />
      </svg>
    </div>
  );
}
