import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// A small centered panel that opens ON TOP of the Weekly Challenge panel
// (the Join-with-song-search panel and the border picker). Uses the app's
// theme tokens (wl-panel / wl-title / ...) so it follows light and dark
// mode on its own. `children` only mount while open, so each sub-panel
// starts fresh (empty search box, no stale selection) every time it opens.
export default function ChallengeSubModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center bg-wl-scrim p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-wl-panel text-wl-fg shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 px-5 py-3.5">
              <span className="text-base font-semibold text-wl-title">{title}</span>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-wl-link/70 transition hover:text-wl-cyan"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
