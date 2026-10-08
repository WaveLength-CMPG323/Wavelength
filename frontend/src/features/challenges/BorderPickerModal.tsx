import { ChevronDown } from 'lucide-react';
import ChallengeSubModal from './ChallengeSubModal';
import BorderFrame from '../../components/BorderFrame';
import type { CosmeticItem } from '../../data/types';

interface Props {
  open: boolean;
  onClose: () => void;
  cosmetics: CosmeticItem[];
  // Passing null equips "no border".
  onSelect: (rewardId: string | null) => void;
  saving: boolean;
  profileImage: string | null;
  initial: string; // fallback letter when there's no profile image
}

// Pick which unlocked border is equipped, from a dropdown. Applies the
// moment a choice is made (same as the old toggle buttons did), with a
// small avatar + song-marker preview so the effect is visible right away.
export default function BorderPickerModal({
  open,
  onClose,
  cosmetics,
  onSelect,
  saving,
  profileImage,
  initial,
}: Props) {
  const unlocked = cosmetics.filter((c) => c.is_unlocked);
  const lockedCount = cosmetics.length - unlocked.length;
  const equipped = unlocked.find((c) => c.is_equipped) ?? null;
  const border = equipped?.css_class;

  return (
    <ChallengeSubModal open={open} title="Profile border" onClose={onClose}>
      <div className="space-y-4 px-5 py-5">
        <div className="flex items-center justify-center gap-24 rounded-xl border border-cyan-500/15 bg-wl-bg py-14">
          <div className="flex flex-col items-center gap-2">
            <BorderFrame border={border} shape="circle" className="h-16 w-16">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-cyan-300 bg-slate-800">
                {profileImage ? (
                  <img src={profileImage} alt="Your profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-slate-200">{initial}</span>
                )}
              </div>
            </BorderFrame>
            <span className="mt-10 text-[10px] font-semibold uppercase tracking-wider text-wl-muted">Profile</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* A plain label instead of album art, which would fight the border. */}
            <BorderFrame border={border} shape="square" className="h-16 w-16">
              <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-cyan-400/70 bg-slate-900 px-1 text-center text-[10px] font-semibold leading-tight text-slate-300">
                Your song
              </div>
            </BorderFrame>
            <span className="mt-10 text-[10px] font-semibold uppercase tracking-wider text-wl-muted">Song marker</span>
          </div>
        </div>

        {unlocked.length === 0 ? (
          <p className="text-sm text-wl-soft">
            You haven&apos;t unlocked any borders yet. Join the weekly challenge to earn this week&apos;s limited-time border.
          </p>
        ) : (
          <div>
            <label htmlFor="border-select" className="mb-1.5 block text-xs font-semibold text-wl-link">
              Your borders
            </label>
            <div className="relative">
              <select
                id="border-select"
                value={equipped?.reward_id ?? ''}
                disabled={saving}
                onChange={(e) => onSelect(e.target.value || null)}
                className="w-full appearance-none rounded-xl border border-cyan-500/25 bg-wl-bg py-2.5 pl-3 pr-9 text-sm text-wl-fg outline-none focus:border-cyan-400 disabled:opacity-60"
              >
                <option value="">No border</option>
                {unlocked.map((c) => (
                  <option key={c.reward_id} value={c.reward_id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wl-icon" />
            </div>
            <p className="mt-2 min-h-[2.25rem] text-xs leading-snug text-wl-muted">
              {saving
                ? 'Saving…'
                : equipped
                  ? equipped.description
                  : 'No border equipped - pick one above to show it on your profile and ocean song marker.'}
            </p>
          </div>
        )}

        {lockedCount > 0 && (
          <p className="text-[11px] text-wl-faint">
            {lockedCount === 1
              ? 'This week\u2019s limited-time border is still up for grabs - join the challenge to unlock it.'
              : `${lockedCount} limited-time borders are up for grabs - join the challenge to unlock them.`}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-cyan-500/25 py-2.5 text-sm font-semibold text-wl-link transition hover:bg-cyan-500/10"
        >
          Done
        </button>
      </div>
    </ChallengeSubModal>
  );
}
