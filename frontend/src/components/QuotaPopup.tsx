import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

// A small centered pop-up for "Spotify's quota has been reached". Themed
// with the app tokens so it follows light and dark mode on its own.
export default function QuotaPopup({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-wl-scrim p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="quota-popup-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-wl-panel p-6 text-center text-wl-fg shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 id="quota-popup-title" className="mt-3 text-lg font-bold text-wl-title">
              Quota reached
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-wl-soft">{message}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-2.5 text-sm font-bold text-slate-950"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
