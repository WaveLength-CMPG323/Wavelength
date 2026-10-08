import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import Cover from '../../components/Cover';
import ChallengeSubModal from './ChallengeSubModal';
import { searchChallengeTracks, submitChallengeEntry } from '../../lib/api';
import type { ActiveChallenge, ChallengeSearchResult } from '../../data/types';

type JoinResult = Awaited<ReturnType<typeof submitChallengeEntry>>;

interface Props {
  open: boolean;
  challenge: Pick<ActiveChallenge, 'id' | 'theme' | 'description'>;
  onClose: () => void;
  // Called once the entry is saved (the modal closes itself right after).
  onJoined: (result: JoinResult) => void;
}

// The "Join" step: shows which challenge this is (name + short description)
// and lets the person search for and confirm their song. Only reachable
// while not yet joined, so the main panel never needs a song search box.
export default function JoinChallengeModal({ open, challenge, onClose, onJoined }: Props) {
  return (
    <ChallengeSubModal open={open} title="Join challenge" onClose={onClose}>
      <JoinBody challenge={challenge} onClose={onClose} onJoined={onJoined} />
    </ChallengeSubModal>
  );
}

function JoinBody({
  challenge,
  onClose,
  onJoined,
}: {
  challenge: Props['challenge'];
  onClose: () => void;
  onJoined: Props['onJoined'];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChallengeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<ChallengeSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setSearching(true);
    searchChallengeTracks(trimmed)
      .then((found) => {
        if (requestId === requestIdRef.current) setResults(found);
      })
      .catch((err) => {
        console.error('Challenge track search failed:', err.message);
        if (requestId === requestIdRef.current) setResults([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setSearching(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  async function confirm() {
    if (!pending || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitChallengeEntry(challenge.id, pending.id);
      onJoined(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit challenge entry');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wl-link">Weekly Theme</p>
        <h3 className="mt-0.5 text-xl font-extrabold tracking-tight text-wl-title">{challenge.theme}</h3>
        <p className="mt-1 text-sm leading-relaxed text-wl-soft">{challenge.description}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-wl-link" htmlFor="challenge-song-search">
          Choose your song
        </label>
        <div className="flex items-center gap-2.5 rounded-xl border border-cyan-500/25 bg-wl-bg px-3 focus-within:border-cyan-400">
          <Search className="h-4 w-4 shrink-0 text-wl-icon" />
          <input
            id="challenge-song-search"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search songs or artists…"
            className="w-full bg-transparent py-2.5 text-sm text-wl-fg outline-none placeholder:text-wl-faint"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => handleQuery('')}
              className="text-wl-muted hover:text-wl-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results sit inline under the box (not floating over it) so the
            whole thing scrolls naturally on a small phone screen. */}
        {!pending && results.length > 0 && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-cyan-500/20 bg-wl-bg">
            {results.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPending(song);
                    setQuery(`${song.title} — ${song.artist}`);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 border-b border-cyan-500/10 px-3 py-2 text-left transition last:border-b-0 hover:bg-cyan-500/10"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cyan-950">
                    <Cover song={song} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-wl-title">{song.title}</p>
                    <p className="truncate text-xs text-wl-muted">{song.artist}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!pending && !searching && query.trim() !== '' && results.length === 0 && (
          <p className="mt-2 text-xs text-wl-muted">No songs found - try another search.</p>
        )}
        {searching && <p className="mt-2 text-xs text-wl-muted">Searching…</p>}
      </div>

      {pending && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cyan-950">
            <Cover song={pending} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-wl-title">{pending.title}</p>
            <p className="truncate text-xs text-wl-muted">{pending.artist}</p>
          </div>
          <Check className="h-5 w-5 shrink-0 text-emerald-500" />
        </div>
      )}

      {error && <p className="text-sm text-wl-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={!pending || submitting}
        className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-300 py-3 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Confirm & submit entry'}
      </button>
      <p className="text-center text-[11px] text-wl-muted">
        Your song will start playing on your Spotify so it shows up in the ocean.
      </p>
    </div>
  );
}
