import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../data/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);

  function handleLogin() {
    setConnecting(true);

    setTimeout(() => {
      login();
      navigate('/', { replace: true });
    }, 700);
  }

  return (
    <main className="login-page">
      <div className="login-brand">
        <div className="login-brand-mark">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
              stroke="#3d2fb0"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <span className="login-brand-word">WaveLength</span>
      </div>

      <p className="login-tagline">
        Discover, connect and listen with people around the world
      </p>

      <div className="login-center">
        <div className="login-card">
          <h1>Welcome</h1>

          <p>
            Sign in to discover new music and connect with people who share
            your sound.
          </p>

          <button
            className="login-spotify-button"
            type="button"
            onClick={handleLogin}
            disabled={connecting}
          >
            <svg
              viewBox="0 0 24 24"
              fill="#1ED760"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="11" />
            </svg>

            <span>
              {connecting ? 'Connecting…' : 'Continue with Spotify'}
            </span>
          </button>

          <div className="login-fine-print">
            By continuing, you agree to WaveLength&apos;s Terms &amp; Privacy
            Policy
          </div>
        </div>
      </div>

      <div className="login-waves-wrap" aria-hidden="true">
        <svg
          className="login-waves"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
          shapeRendering="auto"
        >
          <defs>
            <path
              id="login-gentle-wave"
              d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
            />
          </defs>

          <g className="login-parallax">
            <use
              href="#login-gentle-wave"
              x="48"
              y="0"
              fill="rgba(255,255,255,0.7)"
            />
            <use
              href="#login-gentle-wave"
              x="48"
              y="3"
              fill="rgba(255,255,255,0.5)"
            />
            <use
              href="#login-gentle-wave"
              x="48"
              y="5"
              fill="rgba(255,255,255,0.3)"
            />
            <use
              href="#login-gentle-wave"
              x="48"
              y="7"
              fill="#fff"
            />
          </g>
        </svg>
      </div>
    </main>
  );
}