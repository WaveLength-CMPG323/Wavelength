import { Check, Lock } from 'lucide-react';
import ChallengeSubModal from './ChallengeSubModal';
import BorderFrame from '../../components/BorderFrame';
import type { CosmeticItem } from '../../data/types';

interface Props {
  open: boolean;
  onClose: () => void;
  // The border this challenge rewards (null until the inventory has loaded).
  reward: CosmeticItem | null;
  profileImage: string | null;
  initial: string; // fallback letter when there's no profile image
  // Equips the reward - only offered once it's unlocked.
  onEquip: (rewardId: string) => void;
  saving: boolean;
}

// "What will I get?" - a read-only look at a challenge's reward border,
// shown on a profile avatar and on an (empty) ocean song marker, whether
// or not it's unlocked yet.
export default function RewardPreviewModal({ open, onClose, reward, profileImage, initial, onEquip, saving }: Props) {
  const border = reward?.css_class;

  return (
    <ChallengeSubModal open={open} title="Reward preview" onClose={onClose}>
      {reward && (
        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wl-link">
              Border reward · Limited time
            </p>
            <h3 className="mt-0.5 text-xl font-extrabold tracking-tight text-wl-title">{reward.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-wl-soft">{reward.description}</p>
          </div>

          <div className="flex items-center justify-center gap-24 rounded-xl border border-cyan-500/15 bg-wl-bg py-14">
            <div className="flex flex-col items-center gap-2.5">
              <BorderFrame border={border} shape="circle" className="h-16 w-16">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-cyan-300 bg-slate-800">
                  {profileImage ? (
                    <img src={profileImage} alt="Your profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold text-slate-200">{initial}</span>
                  )}
                </div>
              </BorderFrame>
              <span className="mt-10 text-[10px] font-semibold uppercase tracking-wider text-wl-muted">Profile</span>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              {/* A plain label instead of album art, which would fight the border. */}
              <BorderFrame border={border} shape="square" className="h-16 w-16">
                <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-cyan-400/70 bg-slate-900 px-1 text-center text-[10px] font-semibold leading-tight text-slate-300">
                  Your song
                </div>
              </BorderFrame>
              <span className="mt-10 text-[10px] font-semibold uppercase tracking-wider text-wl-muted">Song marker</span>
            </div>
          </div>

          {reward.is_unlocked ? (
            <>
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 light:text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                You&apos;ve unlocked this border.
              </p>
              <button
                type="button"
                onClick={() => onEquip(reward.reward_id)}
                disabled={saving || reward.is_equipped}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-2.5 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reward.is_equipped ? 'Currently equipped' : saving ? 'Equipping…' : 'Equip this border'}
              </button>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-medium text-wl-muted">
              <Lock className="h-3.5 w-3.5" />
              Join this challenge to unlock it - this border is gone for good once the challenge ends.
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-cyan-500/25 py-2.5 text-sm font-semibold text-wl-link transition hover:bg-cyan-500/10"
          >
            Close
          </button>
        </div>
      )}
    </ChallengeSubModal>
  );
}
