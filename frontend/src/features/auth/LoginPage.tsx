import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Trophy, Users, Waves } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import ThemeToggle from '../../components/ThemeToggle';

// Real login screen (adapted from the team's LandingPage design). "Connect
// with Spotify" does a full-page redirect into the backend's OAuth flow
// (backend/routes/auth.js#/login -> Spotify -> #/callback), which lands
// back here with ?error=... on failure, or back on the Ocean page ("/")
// already logged in on success.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Spotify login was cancelled.',
  state_mismatch: 'Login could not be verified — please try again.',
  token_exchange_failed: "Something went wrong connecting to Spotify — please try again.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const errorReason = params.get('error');

  function handleLogin() {
    setConnecting(true);
    login();
  }

  return (
    <main className="min-h-screen bg-wl-bg text-wl-fg">
      <section className="min-h-screen px-6 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col">
          <header className="flex items-center gap-3">
            <Waves className="size-8 text-wl-icon" aria-hidden="true" />
            <span className="text-xl font-bold text-wl-title">WaveLength</span>
            <ThemeToggle className="ml-auto" />
          </header>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Discover music through the people listening right now
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-wl-soft sm:text-lg">
              Enter a living ocean of music, meet listeners who share your taste, and find your next favourite song.
            </p>

            {errorReason && (
              <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-wl-danger">
                {ERROR_MESSAGES[errorReason] || 'Could not connect to Spotify — please try again.'}
              </p>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={connecting}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#1ED760] px-7 py-3 font-semibold text-black transition-colors hover:bg-[#1fdf64] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1ED760] disabled:opacity-60"
            >
              <Music2 className="size-5" aria-hidden="true" />
              {connecting ? 'Redirecting to Spotify…' : 'Connect with Spotify'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 text-sm font-medium text-wl-link/80 hover:text-wl-cyan"
            >
              Keep browsing as guest
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-cyan-500/20 bg-wl-panel px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-wl-title">Find your people through music</h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-cyan-500/20 bg-wl-bg p-6">
              <Waves className="size-7 text-wl-icon" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Explore the Ocean</h3>
              <p className="mt-2 leading-6 text-wl-soft">
                Discover songs through the live listening activity of other users.
              </p>
            </article>

            <article className="rounded-lg border border-cyan-500/20 bg-wl-bg p-6">
              <Users className="size-7 text-wl-icon" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Join Groups</h3>
              <p className="mt-2 leading-6 text-wl-soft">
                Connect with communities built around shared musical interests.
              </p>
            </article>

            <article className="rounded-lg border border-cyan-500/20 bg-wl-bg p-6">
              <Trophy className="size-7 text-wl-icon" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">Take on Challenges</h3>
              <p className="mt-2 leading-6 text-wl-soft">
                Participate in weekly community challenges and unlock cosmetic profile effects.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="border-t border-cyan-500/20 bg-wl-bg px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-wl-muted sm:flex-row">
          <p>&copy; 2026 WaveLength</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Legal information">
            <a className="hover:text-wl-link" href="#privacy">Privacy Policy</a>
            <a className="hover:text-wl-link" href="#terms">Terms of Use</a>
            <a className="hover:text-wl-link" href="#data-processing">POPIA Data Processing Notice</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
