import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, Music2 } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import BrandLogo from '../../components/BrandLogo';
import ThemeToggle from '../../components/ThemeToggle';
import QuotaPopup from '../../components/QuotaPopup';

// Real login screen. Rebuilt from scratch to match this project's own Ocean
// page visual language (dark sea gradient, cyan wave bands, soft light
// rays, drifting bubbles - see useOceanCanvas.ts) instead of the redesign
// mockup's unfinished LoginPage, which this replaces entirely. Only
// decorative "display" elements were reused here (a lightweight CSS/SVG
// approximation, not the interactive canvas itself) - the real logic below
// (login() -> full-page redirect into the backend's OAuth flow, and the
// ?error=... handling on a failed round-trip) is unchanged from before.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Spotify login was cancelled.',
  state_mismatch: 'Login could not be verified. Please try again.',
  token_exchange_failed: "Something went wrong connecting to Spotify. Please try again.",
  quota_reached: "Spotify's quota for Wavelength has been reached, so new logins can't be accepted right now.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const errorReason = params.get('error');
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  function handleLogin() {
    setConnecting(true);
    login();
  }

  function handleGuest() {
    // Same as how a not-logged-in visitor already lands on "/" - the ocean
    // is public, RequireAuth only guards the routes that need an account.
    navigate('/');
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-wl-bg px-4 py-10 text-wl-fg">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Sky-to-sea background gradient, matching the Ocean page's canvas
          (tokens cross-fade automatically, see @property in index.css). */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, var(--wl-bg) 0%, var(--wl-panel) 55%, var(--wl-panel) 100%)' }}
        aria-hidden="true"
      />

      {/* Soft light rays, same treatment as the Ocean page's ambient shafts. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[18%] top-0 h-[70vh] w-[26vw] -translate-x-1/2 rounded-full bg-cyan-300/10 blur-[90px]" />
        <div className="absolute right-[14%] top-0 h-[60vh] w-[22vw] translate-x-1/2 rounded-full bg-cyan-300/10 blur-[90px]" />
        <div className="absolute left-1/2 top-0 h-[55vh] w-[34vw] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[100px]" />
      </div>

      {/* Rising bubbles. */}
      <div className="login-bubbles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="login-bubble"
            style={{
              left: `${(i * 53.7) % 100}%`,
              width: `${4 + (i % 4) * 3}px`,
              height: `${4 + (i % 4) * 3}px`,
              animationDuration: `${9 + (i % 6) * 2}s`,
              animationDelay: `${-(i * 1.7)}s`,
            }}
          />
        ))}
      </div>

      {/* Layered wave bands at the bottom, colors matching WAVE_BANDS in
          useOceanCanvas.ts. The wrapper spans the full viewport edge to
          edge and the svg uses preserveAspectRatio="xMidYMax slice" (like
          CSS background-size: cover, anchored to the bottom) instead of
          "none": on a very wide/ultra-wide viewport, stretching a fixed
          viewBox non-uniformly could still end up short of covering the
          full width in some browsers/zoom levels, leaving bare
          background-gradient gaps in the bottom corners. "slice" instead
          scales the (wide, multi-hump) pattern up uniformly until it's
          guaranteed to cover the entire width, cropping any excess height
          rather than ever leaving a horizontal gap. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] min-h-[190px] w-full overflow-hidden" aria-hidden="true">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 2400 300"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <path
              id="login-wave-shape"
              d="M0 90c150 0 150 60 300 60s150-60 300-60 150 60 300 60 150-60 300-60 150 60 300 60 150-60 300-60 150 60 300 60 150-60 300-60v210H0z"
            />
          </defs>
          <g className="login-wave-band login-wave-band-1 text-wl-icon/12">
            <use href="#login-wave-shape" fill="currentColor" />
          </g>
          <g className="login-wave-band login-wave-band-2 text-wl-icon/22">
            <use href="#login-wave-shape" x="60" y="40" fill="currentColor" />
          </g>
          <g className="login-wave-band login-wave-band-3 text-wl-icon/38">
            <use href="#login-wave-shape" x="-40" y="80" fill="currentColor" />
          </g>
        </svg>
      </div>

      <QuotaPopup
        open={errorReason === 'quota_reached' && !quotaDismissed}
        message="Spotify's user quota for Wavelength has been reached, so new logins can't be accepted right now. Please try again later - or continue as a guest to watch the ocean."
        onClose={() => setQuotaDismissed(true)}
      />

      {/* Card content. */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-14 w-14" />
          <span className="text-2xl font-semibold tracking-tight text-wl-title">Wavelength</span>
          <p className="text-sm text-wl-muted">Watch what the ocean is listening to, live.</p>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-wl-panel/60 p-6 shadow-[0_20px_60px_rgba(2,24,43,0.55)] backdrop-blur-md">
          {errorReason && (
            <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-100">
              {ERROR_MESSAGES[errorReason] || 'Could not connect to Spotify. Please try again.'}
            </p>
          )}

          {/* Spotify login */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-wl-accent px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#1fdf64] disabled:cursor-wait disabled:opacity-70"
          >
            <Music2 className="h-[18px] w-[18px]" aria-hidden="true" />
            <span>{connecting ? 'Redirecting to Spotify…' : 'Log in with Spotify'}</span>
          </button>
          <p className="mt-2 flex items-start gap-1.5 text-left text-[11px] leading-snug text-wl-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-wl-link/70" aria-hidden="true" />
            <span>
              Spotify Premium is needed to actually interact with songs in the ocean (join a track,
              follow along). Free accounts can still open a song's panel to inspect it, but its buttons
              won't work for you. You can, however, show whatever you're currently playing as your own
              bubble in the ocean, and Premium listeners can join it. Chat works for everyone regardless
              of tier.
            </span>
          </p>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-wl-faint">
            <span className="h-px flex-1 bg-cyan-500/20" />
            or
            <span className="h-px flex-1 bg-cyan-500/20" />
          </div>

          {/* Guest */}
          <button
            type="button"
            onClick={handleGuest}
            className="w-full rounded-full border border-cyan-400/30 px-4 py-3 text-sm font-medium text-wl-title transition-colors hover:bg-cyan-500/10 hover:text-wl-title"
          >
            Continue as guest
          </button>
          <p className="mt-2 flex items-start gap-1.5 text-left text-[11px] leading-snug text-wl-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-wl-link/70" aria-hidden="true" />
            <span>As a guest you can only watch songs drift by. You won't be able to interact with them.</span>
          </p>
        </div>
      </div>
    </main>
  );
}
