import { PRESET_ICONS } from '../data';
import type { AvatarSpec } from '../types';

interface Props { name: string; avatar: AvatarSpec; size?: number }

export function Avatar({ name, avatar, size = 44 }: Props) {
  if (avatar.kind === 'preset') {
    const p = PRESET_ICONS.find((i) => i.id === avatar.presetId) ?? PRESET_ICONS[0];
    return (
      <div
        aria-hidden
        className="grid shrink-0 place-items-center rounded-xl"
        style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
      >
        {p.glyph}
      </div>
    );
  }
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-medium text-white"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${avatar.hue} 65% 42%), hsl(${avatar.hue + 40} 70% 55%))`,
      }}
    >
      {initials}
    </div>
  );
}
