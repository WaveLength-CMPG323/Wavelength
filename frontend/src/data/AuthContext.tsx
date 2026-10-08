import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { fetchMe, logout as apiLogout, pausePlayback, spotifyLoginUrl, setStoredToken } from '../lib/api';
import { reauthSocket } from '../lib/socket';
import type { SpotifyProfile } from './types';

// Real Spotify auth, backed by the Express backend (see
// backend/routes/auth.js). login() does a full-page redirect into the
// OAuth dance. The backend holds the actual Spotify access/refresh
// tokens - all this app ever sees is an opaque bearer token identifying
// "this browser", handed back once in the URL hash right after
// /auth/callback redirects here (picked up below), then kept in
// localStorage and attached to every API call from then on (see
// src/lib/api.ts). This context just asks the backend "is this browser
// logged in?" via /auth/me.

interface AuthContextValue {
  isLoggedIn: boolean;
  profile: SpotifyProfile | null;
  loading: boolean; // true until the initial /auth/me check resolves
  login: () => void;
  logout: () => void;
  refresh: () => void; // re-check session status, e.g. after landing back from Spotify
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Pulls '#wl_token=...' out of the URL (present only right after landing
// back from the OAuth redirect), saves it, and strips it from the address
// bar so it doesn't linger in the browser's history/URL bar.
function consumeTokenFromUrl(): void {
  if (!window.location.hash.startsWith('#wl_token=')) return;
  const token = decodeURIComponent(window.location.hash.slice('#wl_token='.length));
  if (token) setStoredToken(token);
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetchMe()
      .then(({ loggedIn, profile }) => {
        setIsLoggedIn(loggedIn);
        setProfile(profile);
        reauthSocket(); // keep the chat socket's identity in sync with login status
      })
      .catch(() => {
        setIsLoggedIn(false);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Grab the bearer token if we just landed back from /auth/callback, then
  // check login status - this also covers a plain page load/refresh, where
  // there's no hash to consume and the stored token (if any) is used as-is.
  useEffect(() => {
    consumeTokenFromUrl();
    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = spotifyLoginUrl();
  }, []);

  const logout = useCallback(() => {
    // Best-effort: if this browser was playing something on Spotify, stop
    // it so it doesn't keep playing to an empty room after logout. This is
    // allowed to fail silently (no active device, free/non-Premium account,
    // already paused, etc.) - it must never block or break the real logout
    // that follows.
    pausePlayback()
      .catch(() => {
        // non-fatal - proceed with logout regardless
      })
      .finally(() => {
        apiLogout().finally(() => {
          setIsLoggedIn(false);
          setProfile(null);
          reauthSocket(); // tear down/reconnect the chat socket so it stops acting as the old identity
        });
      });
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, profile, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
