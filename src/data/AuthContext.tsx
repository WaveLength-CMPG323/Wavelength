import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// MOCK AUTH ONLY. There is no real Spotify OAuth here -- `login()` just flips a
// flag. When the backend exists, replace login() with the PKCE redirect and
// read the real session instead of localStorage.

const AUTH_KEY = 'wavelength_auth_v1';

interface AuthContextValue {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => localStorage.getItem(AUTH_KEY) === 'true'
  );

  const login = useCallback(() => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
