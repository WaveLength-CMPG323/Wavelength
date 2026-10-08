import type { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
  side?: 'bottom' | 'top';
}

// Small reusable hover tooltip used across the icon-only nav buttons (and
// anywhere else a plain `title` attribute isn't legible/nice enough). Pure
// CSS (group-hover), no JS state, so it's cheap to sprinkle on every button.
export default function Tooltip({ label, children, className = '', side = 'bottom' }: TooltipProps) {
  const positionClasses =
    side === 'bottom'
      ? 'top-full mt-2'
      : 'bottom-full mb-2';

  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`
          pointer-events-none absolute left-1/2 ${positionClasses} z-50
          -translate-x-1/2 whitespace-nowrap rounded-md border border-cyan-500/30
          bg-wl-bg px-2 py-1 text-xs font-medium text-wl-title
          opacity-0 shadow-lg shadow-black/30 transition-opacity duration-150
          group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100
        `}
      >
        {label}
      </span>
    </span>
  );
}
