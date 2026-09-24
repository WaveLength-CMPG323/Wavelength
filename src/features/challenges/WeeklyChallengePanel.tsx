import { useEffect, useState } from 'react';
import {
  Clock3,
  Gift,
  Search,
  Trophy,
  Users,
} from 'lucide-react';

import NavPanel from '../../components/NavPanel';
import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import {
  formatCountdown,
  searchSpotifyCatalog,
  randomCover,
} from '../../data/mockData';
import type { CatalogEntry } from '../../data/types';

function mockParticipants(theme: string): number {
  let hash = 0;

  for (let i = 0; i < theme.length; i++) {
    hash =
      theme.charCodeAt(i) +
      ((hash << 5) - hash);
  }

  return 40 + (Math.abs(hash) % 260);
}

export default function WeeklyChallengePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, mutate } = useData();

  const [remaining, setRemaining] = useState(
    db.challenge.deadline - Date.now()
  );

  const [query, setQuery] = useState('');
  const [results, setResults] =
    useState<CatalogEntry[]>([]);
  const [pending, setPending] =
    useState<CatalogEntry | null>(null);

  useEffect(() => {
    if (!open) return;

    const id = setInterval(() => {
      setRemaining(
        db.challenge.deadline - Date.now()
      );
    }, 1000);

    return () => clearInterval(id);
  }, [open, db.challenge.deadline]);

  const alreadyEntered =
    !!db.challenge.mySubmission;

  const submittedSong =
    db.challenge.mySubmission
      ? db.songs[
          db.challenge.mySubmission.songId
        ]
      : null;

  function handleQuery(value: string) {
    setQuery(value);
    setPending(null);
    setResults(searchSpotifyCatalog(value));
  }

  function submit() {
    if (!pending) return;

    const newId = `me-${Date.now()}`;

    mutate((data) => {
      data.songs[newId] = {
        id: newId,
        title: pending.title,
        artist: pending.artist,
        cover: randomCover(
          pending.title + pending.artist
        ),
        ownerId: 'me',
      };

      data.floaterOrder.push(newId);

      data.challenge.mySubmission = {
        songId: newId,
      };
    });

    setQuery('');
    setResults([]);
    setPending(null);
  }

  return (
    <NavPanel
      open={open}
      onClose={onClose}
      title="Weekly Challenge"
      wide
    >
      <div className="flex flex-col gap-5 px-6 py-6">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#4a3cc9]/90 via-[#3268d2]/90 to-[#17aabd]/90 p-6 shadow-xl">

          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <div className="mb-5 flex items-center justify-between gap-3">

              <span className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                <Trophy className="h-4 w-4 text-yellow-200" />
                This Week's Challenge
              </span>

              <div className="flex items-center gap-2 rounded-full bg-[#091533]/45 px-3 py-1.5 text-xs font-medium text-white">
                <Clock3 className="h-4 w-4 text-cyan-200" />

                {remaining > 0
                  ? formatCountdown(remaining)
                  : 'Closed'}
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Weekly Theme
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {db.challenge.theme}
            </h2>

            <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
              Share a track that captures this
              week's theme. Choose the song that
              best represents your interpretation
              and submit it before the timer runs
              out.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">

              <span className="flex items-center gap-2 text-xs text-white/65">
                <Users className="h-4 w-4" />
                {mockParticipants(
                  db.challenge.theme
                )}{' '}
                joined
              </span>

              {alreadyEntered && (
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                  You're in ✓
                </span>
              )}
            </div>
          </div>
        </section>

        {/* RULES */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
          <h3 className="text-sm font-semibold text-white">
            Challenge Rules
          </h3>

          <div className="mt-3 space-y-2 text-xs leading-5 text-white/60">
            <p>
              • Submit one song that fits this
              week's challenge theme.
            </p>

            <p>
              • Only one entry is allowed per
              person each week.
            </p>

            <p>
              • Your submitted song will appear
              in the Ocean.
            </p>
          </div>
        </section>

        {/* REWARD */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Gift className="h-5 w-5 text-cyan-200" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/40">
                Weekly Reward
              </p>

              <h3 className="text-sm font-semibold text-white">
                Themed Profile Border
              </h3>
            </div>
          </div>

          <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#091533]/35">
            {submittedSong ? (
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-purple-400 via-blue-400 to-cyan-300 opacity-70 blur-md" />

                <div className="relative h-24 w-24 overflow-hidden rounded-xl border-2 border-white/50">
                  <Cover song={submittedSong} />
                </div>
              </div>
            ) : (
              <span className="max-w-xs px-6 text-center text-xs leading-5 text-white/45">
                Submit your challenge song to
                unlock this week's themed profile
                border.
              </span>
            )}
          </div>
        </section>

        {/* SONG SEARCH */}
        <section>
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">
              Your Entry
            </p>

            <h3 className="mt-1 text-sm font-semibold text-white">
              Choose your song
            </h3>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#091533]/45 px-4">
              <Search className="h-4 w-4 shrink-0 text-cyan-200" />

              <input
                type="text"
                disabled={alreadyEntered}
                value={query}
                onChange={(event) =>
                  handleQuery(event.target.value)
                }
                placeholder="Search songs or artists..."
                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-50"
              />
            </div>

            {results.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-[#17245e]/95 shadow-2xl backdrop-blur-xl">

                {results.map((song) => (
                  <button
                    key={`${song.title}-${song.artist}`}
                    onClick={() => {
                      setPending(song);
                      setQuery(
                        `${song.title} — ${song.artist}`
                      );
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left text-sm text-white transition last:border-none hover:bg-white/10"
                    type="button"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                      <Cover song={song} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {song.title}
                      </p>

                      <p className="truncate text-xs text-white/45">
                        {song.artist}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {pending && !alreadyEntered && (
            <button
              onClick={submit}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-semibold text-[#3d2fb0] shadow-md transition hover:bg-white/90"
              type="button"
            >
              Submit Challenge Entry
            </button>
          )}

          {alreadyEntered && (
            <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-center text-sm font-medium text-cyan-100">
              Challenge entry submitted ✓
            </div>
          )}

          <p className="mt-3 text-center text-[11px] text-white/35">
            Limited to one entry per week.
          </p>
        </section>
      </div>
    </NavPanel>
  );
}