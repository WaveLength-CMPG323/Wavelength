import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import AvatarPreview from './AvatarPreview';
import { useAuth } from '../../data/AuthContext';
import { fetchRewards, setActiveCosmetic } from '../../lib/api';
import type { ChallengeReward } from '../../data/types';

// Everything the user has ever earned from a weekly challenge, one card per
// cosmetic. Each card has an on/off toggle - a cosmetic is permanent once
// earned, and you can wear one at a time (switching on another swaps it).
// The choice is saved on the backend and read back via /auth/me, so it
// shows up on the home screen and profile straight away (see refresh()).
export default function ChallengeRewardsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useAuth();
  const [rewards, setRewards] = useState<ChallengeReward[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    fetchRewards()
      .then((r) => {
        if (cancelled) return;
        setRewards(r.rewards);
        setActiveId(r.activeCosmeticId);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your rewards');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function toggle(reward: ChallengeReward) {
    const id = reward.cosmetic.id;
    const turningOff = activeId === id;
    setBusyId(id);
    setError('');
    try {
      await setActiveCosmetic(turningOff ? null : id);
      setActiveId(turningOff ? null : id);
      refresh(); // re-reads /auth/me so the nav avatar + profile update immediately
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your cosmetic');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Challenge Rewards" wide>
      <div className="flex flex-col gap-4 px-6 py-5">
        {error && <p className="text-xs text-red-400">{error}</p>}

        {!rewards && !error && <p className="text-xs text-slate-400">Loading…</p>}

        {rewards && rewards.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Sparkles className="h-6 w-6 text-cyan-400/70" />
            <p className="text-sm font-medium text-cyan-100">No rewards yet</p>
            <p className="max-w-xs text-xs text-slate-400">
              Complete this week’s challenge to earn your first profile cosmetic. A new one is up for grabs every week,
              and you keep each one forever.
            </p>
          </div>
        )}

        {rewards && rewards.length > 0 && (
          <>
            <p className="text-xs text-slate-400">
              {rewards.length} collected · switch one on to wear it on your profile and the ocean.
            </p>
            <ul className="grid grid-cols-2 gap-3">
              {rewards.map((r) => {
                const equipped = activeId === r.cosmetic.id;
                return (
                  <li
                    key={r.cosmetic.id}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center ${
                      equipped ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-cyan-500/20 bg-[#02182b]'
                    }`}
                  >
                    <AvatarPreview cosmetic={r.cosmetic} size={72} />
                    <p className="text-sm font-semibold text-cyan-100">{r.cosmetic.name}</p>
                    <p className="text-[11px] leading-snug text-slate-400">{r.cosmetic.description}</p>
                    <p className="text-[11px] text-slate-500">
                      {r.theme} · {new Date(r.earnedAt).toLocaleDateString()}
                    </p>
                    {r.track.name && (
                      <p className="max-w-full truncate text-[11px] text-slate-500">♪ {r.track.name}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      disabled={busyId === r.cosmetic.id}
                      aria-pressed={equipped}
                      className={`mt-1 w-full rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        equipped
                          ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          : 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                      }`}
                    >
                      {equipped ? 'Equipped ✓' : 'Equip'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </NavPanel>
  );
}
