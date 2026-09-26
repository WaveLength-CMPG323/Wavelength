import { PRESET_ICONS } from '../data';
import type { AvatarSpec } from '../types';

interface Props { name: string; avatar: AvatarSpec; size?: number }

/** Generic person silhouette — used for every friend avatar, on a solid colour disc. */
function PersonGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="#fff" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"
      />
    </svg>
  );
}

export function Avatar({ name, avatar, size = 44 }: Props) {
  if (avatar.kind === 'preset') {
    const p = PRESET_ICONS.find((i) => i.id === avatar.presetId) ?? PRESET_ICONS[0];
    return (
      <div
        role="img"
        aria-label={name}
        className="grid shrink-0 place-items-center rounded-xl"
        style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
      >
        {p.glyph}
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: avatar.color }}
    >
      <PersonGlyph className="h-[56%] w-[56%]" />
    </div>
  );
}
