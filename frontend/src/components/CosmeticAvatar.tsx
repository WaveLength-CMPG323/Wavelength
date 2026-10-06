import type { CSSProperties, ReactNode } from 'react';
import type { Cosmetic } from '../data/types';

interface Props {
  cosmetic?: Cosmetic | null;
  size: number; // outer diameter in px - the same with or without a cosmetic, so equipping never shifts the layout
  children: ReactNode; // the avatar itself; should fill its box (h-full w-full)
  className?: string;
}

// Draws a weekly-challenge cosmetic around an avatar. Used wherever a
// profile picture appears for the logged-in user (ocean nav, profile page,
// rewards gallery), so a reward looks identical everywhere.
//
// With no cosmetic it's a plain fixed-size box around the children, so
// callers can use it unconditionally.
export default function CosmeticAvatar({ cosmetic, size, children, className = '' }: Props) {
  if (!cosmetic) {
    return (
      <span className={`inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
        {children}
      </span>
    );
  }

  const ring = Math.max(2, Math.round(size / 14)); // 32px -> 2, 112px -> 8
  const gap = Math.max(1, Math.round(size / 40)); // dark gap between ring and picture

  const vars = { '--wl-c1': cosmetic.color, '--wl-c2': cosmetic.accent } as CSSProperties;

  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full ${cosmetic.kind === 'glow' ? 'wl-glow' : ''} ${className}`}
      style={{ width: size, height: size, ...vars }}
      title={cosmetic.name}
    >
      {cosmetic.kind === 'ripple' && (
        <>
          <span
            aria-hidden="true"
            className="wl-ripple pointer-events-none absolute inset-0 rounded-full border-2"
            style={{ borderColor: cosmetic.color }}
          />
          <span
            aria-hidden="true"
            className="wl-ripple pointer-events-none absolute inset-0 rounded-full border-2"
            style={{ borderColor: cosmetic.accent, animationDelay: '1.2s' }}
          />
        </>
      )}

      {/* The ring itself: a gradient with the picture inset inside it. */}
      <span
        className="relative flex h-full w-full overflow-hidden rounded-full"
        style={{
          padding: ring,
          background: `conic-gradient(from 45deg, ${cosmetic.color}, ${cosmetic.accent}, ${cosmetic.color})`,
        }}
      >
        <span
          className="flex h-full w-full overflow-hidden rounded-full bg-[#02182b]"
          style={{ padding: gap }}
        >
          {children}
        </span>
      </span>
    </span>
  );
}
