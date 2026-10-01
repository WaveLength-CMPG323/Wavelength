import { useEffect, useState } from 'react';
import axios from 'axios';
import NavPanel from '../../components/NavPanel';

interface RewardItem {
  rewardId: string;
  name: string;
  description: string;
  cssClass: string;
  isUnlocked: boolean;
  isEquipped: boolean;
}

interface RewardsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function RewardsPanel({ open, onClose }: RewardsPanelProps) {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function fetchInventory() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/cosmetics/inventory');
        setRewards(res.data.rewards || []);
      } catch (err: any) {
        console.error('Failed to load cosmetics inventory:', err);
        setError('Could not load unlocked rewards.');
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
  }, [open]);

  async function handleEquipToggle(rewardId: string, currentEquipped: boolean) {
    try {
      const nextEquipped = !currentEquipped;
      await axios.post('/cosmetics/equip', {
        rewardId,
        isEquipped: nextEquipped
      });

      setRewards((prev) =>
        prev.map((r) => {
          if (r.rewardId === rewardId) {
            return { ...r, isEquipped: nextEquipped };
          }
          // If equipping this one, unequip others (single-active rule)
          if (nextEquipped) {
            return { ...r, isEquipped: false };
          }
          return r;
        })
      );
    } catch (err) {
      console.error('Failed to update equipment state:', err);
    }
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Unlocked Cosmetics" wide>
      <div className="flex flex-col gap-4 px-6 py-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-xs text-slate-400">
            Loading cosmetics...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        ) : rewards.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-center text-xs text-slate-400">
            No rewards unlocked yet. Complete weekly challenges to earn exclusive aesthetics!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rewards.map((item) => (
              <div
                key={item.rewardId}
                className={`flex items-center justify-between rounded-xl border p-4 transition ${
                  item.isEquipped
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-md'
                    : 'border-cyan-500/20 bg-[#02233b]/80'
                }`}
              >
                <div className="flex flex-col gap-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.name}</span>
                    <span
                      className={`inline-block h-3 w-3 rounded-full border ${item.cssClass}`}
                      title={item.cssClass}
                    />
                  </div>
                  <p className="text-xs text-slate-300">{item.description}</p>
                  {!item.isUnlocked && (
                    <span className="text-[10px] text-amber-400">Locked</span>
                  )}
                </div>

                <button
                  onClick={() => handleEquipToggle(item.rewardId, item.isEquipped)}
                  disabled={!item.isUnlocked}
                  type="button"
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                    item.isEquipped
                      ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {item.isEquipped ? 'Equipped ✓' : 'Equip'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </NavPanel>
  );
}