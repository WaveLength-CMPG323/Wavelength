import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface NavPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

// Shared centered modal shell (backdrop + card) used by Notifications,
// Weekly Challenges and Create Group.
export default function NavPanel({
  open,
  onClose,
  title,
  children,
  wide,
}: NavPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#04385a] shadow-2xl ${
              wide ? 'max-w-md' : 'max-w-sm'
            }`}
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 8,
            }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 300,
            }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/20 px-5 py-4">
              <span className="text-base font-semibold text-cyan-100">
                {title}
              </span>

              <button
                aria-label="Close panel"
                onClick={onClose}
                className="text-cyan-300/70 transition hover:text-cyan-200"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable panel content */}
            <div className="nav-panel-scroll overflow-x-hidden overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}