import { useEffect, useState } from 'react';
import { ExternalLink, ListMusic } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';
import { fetchRecentlyPlayed, fetchPublicPlaylists } from '../../lib/api';
import type { RecentTrack, PublicPlaylist } from '../../data/types';

// "played 5m ago" / "played 3h ago" / "played 2d ago" from an ISO timestamp.
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MyProfilePage() {
  const { db, mutate } = useData();
  const { profile } = useAuth();
  const { me } = db;
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio);
  const [genreInput, setGenreInput] = useState('');
  const [toast, setToast] = useState(false);

  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [recentError, setRecentError] = useState('');
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
  const [playlistsError, setPlaylistsError] = useState('');

  const groupsCount = Object.values(db.groups).filter((g) => g.members.includes('me')).length;

  // Real Spotify data for this page - separate from the mock nickname/bio/
  // genres above, which are still app-only local state (no backend for
  // those yet). Both need the user-read-recently-played / playlist-read-
  // private scopes, so this quietly fails with a clear message for anyone
  // who logged in before those scopes were added (see routes/auth.js).
  useEffect(() => {
    fetchRecentlyPlayed()
      .then(setRecentTracks)
      .catch((err) => setRecentError(err instanceof Error ? err.message : 'Could not load recently played tracks'));
    fetchPublicPlaylists()
      .then(setPlaylists)
      .catch((err) => setPlaylistsError(err instanceof Error ? err.message : 'Could not load playlists'));
  }, []);

  function addGenre(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const value = genreInput.trim();
    if (!value) return;
    mutate((d) => { d.me.genres.push(value); });
    setGenreInput('');
  }

  function removeGenre(index: number) {
    mutate((d) => { d.me.genres.splice(index, 1); });
  }

  function save() {
    mutate((d) => {
      d.me.nickname = nickname.trim();
      d.me.bio = bio.trim();
    });
    setToast(true);
    setTimeout(() => setToast(false), 1800);
  }

  return (
    <div className="min-h-screen bg-[#02182b] pb-24 text-white">
      <PageHeader title="Your Profile" />

      <div className="mx-auto my-8 max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#04385a]/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
        {/* Header: real Spotify avatar + name + editable fields */}
        <div className="flex flex-col items-center gap-6 border-b border-cyan-500/20 pb-6 sm:flex-row sm:items-start">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
            {profile?.profileImage ? (
              <img src={profile.profileImage} alt="Your Spotify profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-semibold text-slate-700">
                {(profile?.displayName || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-4">
            {profile?.displayName && (
              <p className="text-sm text-cyan-300">
                Spotify: <span className="font-semibold text-cyan-100">{profile.displayName}</span>
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-cyan-300">Nickname</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What should people call you?"
                className="w-full rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-cyan-300">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="Say something about yourself…"
                className="w-full rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-around border-b border-cyan-500/20 py-6 text-center">
          <div>
            <p className="text-xl font-bold text-cyan-100">{groupsCount}</p>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Groups</p>
          </div>
          <div>
            <p className="text-xl font-bold text-cyan-100">{me.genres.length}</p>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Genres</p>
          </div>
        </div>

        {/* Genre pills */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">Genres you like</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {me.genres.map((g, i) => (
              <span
                key={g + i}
                className="flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 shadow-sm"
              >
                {g}
                <button onClick={() => removeGenre(i)} aria-label={`Remove ${g}`} className="text-slate-500" type="button">&times;</button>
              </span>
            ))}
            {me.genres.length === 0 && <span className="text-xs text-slate-400">No genres added yet.</span>}
          </div>
          <input
            value={genreInput}
            onChange={(e) => setGenreInput(e.target.value)}
            onKeyDown={addGenre}
            placeholder="+ Add genre, press Enter"
            className="w-full rounded-lg border border-dashed border-cyan-500/30 bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* Recently played - real Spotify listening history */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">Recently played</h3>
          {recentError ? (
            <p className="text-xs text-red-400">{recentError}</p>
          ) : recentTracks.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing played recently.</p>
          ) : (
            <ul className="space-y-2">
              {recentTracks.map((t, i) => (
                <li key={`${t.trackId}-${t.playedAt}-${i}`} className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-cyan-950">
                    {t.albumArt && <img src={t.albumArt} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-cyan-100">{t.name}</p>
                    <p className="truncate text-xs text-slate-400">{t.artist}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(t.playedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Public playlists */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">Public playlists</h3>
          {playlistsError ? (
            <p className="text-xs text-red-400">{playlistsError}</p>
          ) : playlists.length === 0 ? (
            <p className="text-xs text-slate-400">No public playlists on this account.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {playlists.map((p) => (
                <a
                  key={p.id}
                  href={p.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-cyan-500/10 bg-[#02182b] p-2 transition hover:border-cyan-500/30"
                >
                  <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-cyan-950">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ListMusic className="h-6 w-6 text-cyan-500/50" />
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-cyan-100 group-hover:text-cyan-300">{p.name}</p>
                  <p className="text-[11px] text-slate-500">{p.trackCount} tracks</p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Real Spotify identity */}
        <div className="pt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">Connected to Spotify</h3>
          <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
              {profile?.profileImage && <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-200">{profile?.displayName || 'Unknown'}</p>
              {/* As of Spotify's February 2026 Web API changes, /me no
                  longer returns email at all - not a scope issue, Spotify
                  just stopped providing it to any app. profile.email will
                  always be null now; kept in the type/response in case
                  Spotify ever reverses this. */}
              <p className="truncate text-xs text-slate-500">
                {profile?.email || 'Spotify no longer shares account email with apps'}
              </p>
            </div>
            {profile?.profileUrl && (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
              >
                <ExternalLink className="h-3 w-3" />
                View profile
              </a>
            )}
          </div>
        </div>

        <button
          onClick={save}
          type="button"
          className="mt-6 w-full rounded-md bg-[#1ED760] py-2.5 text-sm font-semibold text-black transition hover:bg-[#1fdf64]"
        >
          Save changes
        </button>
      </div>

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition-opacity ${toast ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        Profile saved
      </div>
    </div>
  );
}
