import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Music2 } from 'lucide-react';
import { useAuth } from '../../data/AuthContext';
import BrandLogo from '../../components/BrandLogo';

// Welcome message for visitors who are not logged in. It says what the
// ocean is and that logging in is needed to interact, then gets out of the
// way. Closing it only lasts for the current browser tab session.
const STORAGE_KEY = 'wl-guest-welcome-dismissed';

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function GuestWelcome() {
  const { isLoggedIn, loading, login } = useAuth();
  const [dismissed, setDismissed] = useState(wasDismissed);

  const open = !loading && !isLoggedIn && !dismissed;

  function close() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // fine: it just shows again next time
    }
    setDismissed(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-wl-scrim p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-welcome-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-wl-panel p-6 text-center text-wl-fg shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <BrandLogo className="mx-auto h-12 w-12" />
            <h2 id="guest-welcome-title" className="mt-3 text-xl font-bold text-wl-title">
              Welcome to Wavelength
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-wl-soft">
              Every square in the ocean is a song someone is listening to right now.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-wl-soft">
              You can look around, but to open songs, chat and join challenges you need to log in with Spotify.
            </p>
            <button
              type="button"
              onClick={login}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-wl-accent px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#1fdf64]"
            >
              <Music2 className="h-[18px] w-[18px]" aria-hidden="true" />
              Log in with Spotify
            </button>
            <button
              type="button"
              onClick={close}
              className="mt-2 w-full rounded-full border border-cyan-400/30 px-4 py-3 text-sm font-medium text-wl-title transition-colors hover:bg-cyan-500/10"
            >
              Just look around
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
