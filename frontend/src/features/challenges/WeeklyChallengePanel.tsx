import { useEffect, useState } from 'react';
import axios from 'axios';
import NavPanel from '../../components/NavPanel';
import { OceanWaveIcon } from '../../components/icons/OceanWaveIcon';

interface ChallengeSubmission {
  trackId: string;
  title: string;
  artist: string;
  cover: string;
}

interface Challenge {
  id: number;
  theme: string;
  description: string;
  rewardId?: string;
  deadline: string;
  mySubmission?: ChallengeSubmission | null;
}

interface ChallengeTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

interface WeeklyChallengePanelProps {
  open: boolean;
  onClose: () => void;
  onOpenRewards?: () => void;
}

export default function WeeklyChallengePanel({ open, onClose, onOpenRewards }: WeeklyChallengePanelProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<ChallengeTrack[]>([]);
  const [pending, setPending] = useState<ChallengeTrack | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch active challenge from backend when panel opens
  useEffect(() => {
    if (!open) return;
    
    async function fetchActiveChallenge() {
      try {
        const res = await axios.get<Challenge>('/challenge/active');
        setChallenge(res.data);
        const deadlineMs = new Date(res.data.deadline).getTime();
        setRemaining(deadlineMs - Date.now());
      } catch (err) {
        console.error('Failed to fetch active challenge:', err);
      }
    }
    
    fetchActiveChallenge();
  }, [open]);

  // Countdown timer ticker
  useEffect(() => {
    if (!open || !challenge) return;
    const deadlineMs = new Date(challenge.deadline).getTime();
    const id = setInterval(() => setRemaining(deadlineMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, challenge]);

  function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Closed';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    return `${hours}h left`;
  }

  const alreadyEntered = !!challenge?.mySubmission;

  // Search Spotify catalog via backend proxy route
  async function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    setErrorMessage(null);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    try {
      const res = await axios.get(`/challenge/search?q=${encodeURIComponent(value)}`);
      
      const mappedResults: ChallengeTrack[] = (res.data.results || []).map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        cover: track.cover
      }));

      setResults(mappedResults);
    } catch (err) {
      console.error('Spotify catalog search failed:', err);
    }
  }

  // Submit entry to backend API
  async function submit() {
    if (!pending || !challenge) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await axios.post('/challenge/submit', {
        challengeId: challenge.id,
        trackId: pending.id
      });
      
      setChallenge((prev) => prev ? {
        ...prev,
        mySubmission: {
          trackId: pending.id,
          title: response.data.submission.title,
          artist: response.data.submission.artist,
          cover: response.data.submission.cover
        }
      } : null);
      setQuery('');
      setResults([]);
      setPending(null);
    } catch (err: any) {
      console.error('Challenge submission failed:', err);
      setErrorMessage(err.response?.data?.error || 'Challenge submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!challenge) {
    return (
      <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
        <div className="flex h-48 items-center justify-center text-xs text-slate-400">
          Loading challenge...
        </div>
      </NavPanel>
    );
  }

  const submittedSong = challenge.mySubmission ? {
    title: challenge.mySubmission.title,
    artist: challenge.mySubmission.artist,
    cover: challenge.mySubmission.cover
  } : pending;

  return (
    <NavPanel open={open} onClose={onClose} title="Weekly Challenge" wide>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="rounded-xl border border-cyan-500/20 bg-[#02233b]/80 p-4 shadow-md backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
              <OceanWaveIcon className="h-3 w-3" />
              {challenge.theme}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {remaining > 0 ? formatCountdown(remaining) : 'Closed'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {challenge.description}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-3 text-xs">
            {alreadyEntered ? (
              <span className="font-semibold text-cyan-300">You're in ✓</span>
            ) : (
              <span className="text-slate-400">No submission yet</span>
            )}
            {onOpenRewards && (
              <button
                onClick={onOpenRewards}
                type="button"
                className="font-medium text-cyan-300 underline hover:text-cyan-200"
              >
                View Rewards & Cosmetics →
              </button>
            )}
          </div>
        </div>

        <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-cyan-500/20 bg-[#02182b]">
          {submittedSong ? (
            <div className="flex items-center gap-3 px-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                <img src={submittedSong.cover} alt={submittedSong.title} className="h-full w-full object-cover" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">{submittedSong.title}</p>
                <p className="text-[11px] text-slate-400">{submittedSong.artist}</p>
              </div>
            </div>
          ) : (
            <span className="px-6 text-center text-xs text-slate-400">
              Reward ({challenge.rewardId || 'Exclusive'}) — search and select a song to unlock
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            disabled={alreadyEntered}
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search Spotify for a song to submit…"
            className="w-full rounded-full border border-cyan-500/20 bg-[#02182b] px-4 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-50"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-cyan-500/20 bg-[#04385a] shadow-lg max-h-60 overflow-y-auto">
              {results.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setPending(s); setQuery(`${s.title} — ${s.artist}`); setResults([]); setErrorMessage(null); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/10"
                  type="button"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
                    <img src={s.cover} alt={s.title} className="h-full w-full object-cover" />
                  </div>
                  <span>{s.title} — {s.artist}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {pending && !alreadyEntered && (
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-cyan-400 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            type="button"
          >
            {submitting ? 'Submitting...' : 'Submit Entry'}
          </button>
        )}
        {alreadyEntered && (
          <div className="flex flex-col gap-2">
            <div className="text-center text-sm font-medium text-cyan-300">Entered — good luck!</div>
            {onOpenRewards && (
              <button
                onClick={onOpenRewards}
                type="button"
                className="w-full rounded-full border border-cyan-500/30 bg-cyan-500/10 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Check Unlocked Cosmetics
              </button>
            )}
          </div>
        )}
        <div className="text-center text-xs text-slate-500">Limited to one entry per week.</div>
      </div>
    </NavPanel>
  );
}