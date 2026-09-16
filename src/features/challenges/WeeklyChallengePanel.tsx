import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import NavPanel from '../../components/NavPanel';
import Cover from '../../components/Cover';
import { OceanWaveIcon } from '../../components/icons/OceanWaveIcon';
import { useData } from '../../data/DataContext';
import { formatCountdown, searchSpotifyCatalog, randomCover } from '../../data/mockData';
import type { CatalogEntry } from '../../data/types';

// Deterministic mock "X joined" count, purely cosmetic (we don't track this).
function mockParticipants(theme: string): number {
  let hash = 0;
  for (let i = 0; i < theme.length; i++) hash = theme.charCodeAt(i) + ((hash << 5) - hash);
  return 40 + (Math.abs(hash) % 260);
}

export default function WeeklyChallengePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, mutate } = useData();
  const [remaining, setRemaining] = useState(db.challenge.deadline - Date.now());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [pending, setPending] = useState<CatalogEntry | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setRemaining(db.challenge.deadline - Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, db.challenge.deadline]);

  const alreadyEntered = !!db.challenge.mySubmission;
  const submittedSong = db.challenge.mySubmission ? db.songs[db.challenge.mySubmission.songId] : null;

  function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    setResults(searchSpotifyCatalog(value));
  }

  function submit() {
    if (!pending) return;
    const newId = 'me-' + Date.now();
    mutate((d) => {
      d.songs[newId] = { id: newId, title: pending.title, artist: pending.artist, cover: randomCover(pending.title + pending.artist), ownerId: 'me' };
      d.floaterOrder.push(newId);
      d.challenge.mySubmission = { songId: newId };
    });
    setQuery('');
    setResults([]);
    setPending(null);
  }

  return (
    <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="rounded-xl border border-cyan-500/20 bg-[#02233b]/80 p-4 shadow-md backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
              <OceanWaveIcon className="h-3 w-3" />
              {db.challenge.theme}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {remaining > 0 ? `${formatCountdown(remaining)} left` : 'Closed'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Share a track that captures this week's theme. Entering unlocks a themed profile border while the challenge runs.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-3 text-xs">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Users className="h-3.5 w-3.5 text-cyan-400" />
              {mockParticipants(db.challenge.theme)} joined
            </span>
            {alreadyEntered && <span className="font-semibold text-cyan-300">You're in ✓</span>}
          </div>
        </div>

        <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-cyan-500/20 bg-[#02182b]">
          {submittedSong ? (
            <div className="h-24 w-24 overflow-hidden rounded-lg">
              <Cover song={submittedSong} />
            </div>
          ) : (
            <span className="px-6 text-center text-xs text-slate-400">
              Themed border reward — upload a song to unlock
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            disabled={alreadyEntered}
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search for a song to upload…"
            className="w-full rounded-full border border-cyan-500/20 bg-[#02182b] px-4 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-50"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-cyan-500/20 bg-[#04385a] shadow-lg">
              {results.map((s) => (
                <button
                  key={s.title}
                  onClick={() => { setPending(s); setQuery(`${s.title} — ${s.artist}`); setResults([]); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/10"
                  type="button"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded"><Cover song={s} /></div>
                  <span>{s.title} — {s.artist}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {pending && !alreadyEntered && (
          <button
            onClick={submit}
            className="rounded-full bg-cyan-400 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            type="button"
          >
            Submit
          </button>
        )}
        {alreadyEntered && (
          <div className="text-center text-sm font-medium text-cyan-300">Entered — good luck!</div>
        )}
        <div className="text-center text-xs text-slate-500">Limited to one entry per week.</div>
      </div>
    </NavPanel>
  );
}
