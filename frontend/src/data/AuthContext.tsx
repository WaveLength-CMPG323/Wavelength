import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { fetchMe, logout as apiLogout, spotifyLoginUrl } from '../lib/api';
import type { SpotifyProfile } from './types';

// Real Spotify auth, backed by the Express backend's session cookie (see
// backend/routes/auth.js). login() does a full-page redirect into the
// OAuth dance; there's no client-side token handling here at all - the
// backend holds the access/refresh tokens and this context just asks it
// "is this browser logged in?" via /auth/me.

interface AuthContextValue {
  isLoggedIn: boolean;
  profile: SpotifyProfile | null;
  loading: boolean; // true until the initial /auth/me check resolves
  login: () => void;
  logout: () => void;
  refresh: () => void; // re-check session status, e.g. after landing back from Spotify
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetchMe()
      .then(({ loggedIn, profile }) => {
        setIsLoggedIn(loggedIn);
        setProfile(profile);
      })
      .catch(() => {
        setIsLoggedIn(false);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Check session status once on load. This also covers landing back on
  // the Ocean page right after /auth/callback redirects here post-login.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = spotifyLoginUrl();
  }, []);

  const logout = useCallback(() => {
    apiLogout().finally(() => {
      setIsLoggedIn(false);
      setProfile(null);
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
