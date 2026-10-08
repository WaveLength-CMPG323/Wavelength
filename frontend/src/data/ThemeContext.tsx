import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ResolvedTheme = 'light' | 'dark';
// 'system' = no manual choice yet: follow the OS (live, including when it
// flips at sunset on a phone). 'light' / 'dark' = the user picked one.
type Preference = 'system' | ResolvedTheme;

const STORAGE_KEY = 'wl-theme';
const QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: ResolvedTheme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): Preference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked (private mode etc.) - just follow the system
  }
  return 'system';
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>(readPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  // Track OS theme changes for as long as the app is open.
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const theme: ResolvedTheme = preference === 'system' ? system : preference;

  // Reflect on <html> so the CSS tokens in index.css swap.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: ResolvedTheme = theme === 'dark' ? 'light' : 'dark';
    // Flipping back to whatever the OS already is means "I'm not overriding
    // anything" - go back to following the system rather than pinning it.
    const nextPref: Preference = next === system ? 'system' : next;
    setPreference(nextPref);
    try {
      if (nextPref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, nextPref);
    } catch {
      // non-fatal
    }
  }, [theme, system]);

  const value = useMemo(() => ({ theme, isDark: theme === 'dark', toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
