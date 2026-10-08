import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ListMusic } from 'lucide-react';
import BorderFrame from '../../components/BorderFrame';
import PageHeader from '../../components/PageHeader';
import OceanBackdrop from '../../components/OceanBackdrop';
import { useAuth } from '../../data/AuthContext';
import { useCosmetics } from '../../data/CosmeticsContext';
import {
  fetchRecentlyPlayed,
  fetchPublicPlaylists,
  fetchProfileStats,
  fetchHostProfile,
  saveProfileDetails,
} from '../../lib/api';
import type { RecentTrack, PublicPlaylist, ProfileStats } from '../../data/types';

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
  const { profile } = useAuth();
  const { equippedEffectCss } = useCosmetics();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  // What's currently saved on the backend - compared against the inputs to
  // tell whether there are unsaved changes.
  const [savedNickname, setSavedNickname] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  // Set once the person types anything, so a slow initial load can't
  // overwrite what they've already started typing.
  const touchedRef = useRef(false);

  const dirty = nickname.trim() !== savedNickname || bio.trim() !== savedBio;

  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [recentError, setRecentError] = useState('');
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
  const [playlistsError, setPlaylistsError] = useState('');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsError, setStatsError] = useState('');

  // Real Spotify data for this page, plus the real (backend-persisted)
  // nickname/bio - loaded via the same endpoint used to view someone
  // else's profile (GET /spotify/user/:spotifyUserId), since it always
  // returns whatever's stored for a given Spotify account, self included.
  // The three fetch* calls need scopes added to the OAuth flow at various
  // points (see routes/auth.js), so each quietly fails with its own clear
  // message for anyone who logged in before the relevant scope was added.
  useEffect(() => {
    fetchRecentlyPlayed()
      .then(setRecentTracks)
      .catch((err) => setRecentError(err instanceof Error ? err.message : 'Could not load recently played tracks'));
    fetchPublicPlaylists()
      .then(setPlaylists)
      .catch((err) => setPlaylistsError(err instanceof Error ? err.message : 'Could not load playlists'));
    fetchProfileStats()
      .then(setStats)
      .catch((err) => setStatsError(err instanceof Error ? err.message : 'Could not load profile stats'));
  }, []);

  useEffect(() => {
    if (!profile?.spotifyUserId) return;
    fetchHostProfile(profile.spotifyUserId)
      .then(({ profile: p }) => {
        setSavedNickname(p.nickname ?? '');
        setSavedBio(p.bio ?? '');
        if (touchedRef.current) return;
        setNickname(p.nickname ?? '');
        setBio(p.bio ?? '');
      })
      .catch(() => {
        // Non-fatal - the fields just start blank, same as never having set one.
      });
  }, [profile?.spotifyUserId]);

  // Browser-level guard for refresh / closing the tab while edits are unsaved.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Returns true if the save went through.
  async function save(): Promise<boolean> {
    setSaveError('');
    setSaving(true);
    try {
      const saved = await saveProfileDetails(nickname.trim(), bio.trim());
      setNickname(saved.nickname ?? '');
      setBio(saved.bio ?? '');
      setSavedNickname(saved.nickname ?? '');
      setSavedBio(saved.bio ?? '');
      setToast(true);
      setTimeout(() => setToast(false), 1800);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (dirty) setShowLeavePrompt(true);
    else navigate('/');
  }

  async function saveAndLeave() {
    if (await save()) navigate('/');
    else setShowLeavePrompt(false); // stay on the page so the error is visible
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-wl-bg pb-24 text-wl-fg">
      {/* Background atmosphere - shared animated sky/wave/bubble backdrop
          (same "alive" treatment as the Ocean page, minus its interactive
          canvas) instead of a static gradient. */}
      <OceanBackdrop />

      <div className="relative z-10">
        <PageHeader title="Your Profile" onBack={handleBack} />

      <div className="mx-auto my-8 max-w-4xl rounded-3xl border border-cyan-500/20 bg-wl-panel/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
        {/* Header: real Spotify avatar + name + editable fields */}
        <div className="flex flex-col items-center gap-6 border-b border-cyan-500/20 pb-6 sm:flex-row sm:items-start">
          {/* The border art spills well outside the picture, so reserve room for it when one is equipped. */}
          <BorderFrame border={equippedEffectCss} shape="circle" className={`h-28 w-28 ${equippedEffectCss ? 'm-10 sm:mr-12' : ''}`}>
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt="Your Spotify profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-slate-700">
                  {(profile?.displayName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </BorderFrame>

          <div className="flex-1 space-y-4">
            {profile?.displayName && (
              <p className="text-sm text-wl-link">
                Spotify: <span className="font-semibold text-wl-title">{profile.displayName}</span>
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-wl-link">Nickname</label>
              <input
                value={nickname}
                onChange={(e) => {
                  touchedRef.current = true;
                  setNickname(e.target.value);
                }}
                placeholder="What should people call you?"
                className="w-full rounded-lg border border-cyan-500/20 bg-wl-bg px-3 py-2 text-sm text-wl-fg placeholder:text-wl-faint"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-wl-link">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  touchedRef.current = true;
                  setBio(e.target.value);
                }}
                rows={2}
                placeholder="Say something about yourself…"
                className="w-full rounded-lg border border-cyan-500/20 bg-wl-bg px-3 py-2 text-sm text-wl-fg placeholder:text-wl-faint"
              />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-around border-b border-cyan-500/20 py-6 text-center">
          <div>
            <p className="text-xl font-bold text-wl-title">{stats?.followers != null ? stats.followers : '—'}</p>
            <p className="text-xs uppercase tracking-wider text-wl-link">Followers</p>
          </div>
          <div>
            <p className="text-xl font-bold text-wl-title">{stats ? stats.following : '—'}</p>
            <p className="text-xs uppercase tracking-wider text-wl-link">Following</p>
          </div>
        </div>

        {/* Top genres - real Spotify listening data, read-only (no more
            manual add/remove; the mock d.me.genres field itself is left
            alone for other parts of the app that may still use it). */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-wl-link">Top genres</h3>
          {statsError ? (
            <p className="text-xs text-wl-danger">{statsError}</p>
          ) : stats && stats.topGenres.length === 0 ? (
            <p className="text-xs text-wl-muted">Not enough listening history yet to tell your top genres.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(stats?.topGenres ?? []).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 shadow-sm"
                >
                  {g}
                </span>
              ))}
              {!stats && !statsError && <span className="text-xs text-wl-muted">Loading…</span>}
            </div>
          )}
        </div>

        {/* Recently played - real Spotify listening history */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-wl-link">Recently played</h3>
          {recentError ? (
            <p className="text-xs text-wl-danger">{recentError}</p>
          ) : recentTracks.length === 0 ? (
            <p className="text-xs text-wl-muted">Nothing played recently.</p>
          ) : (
            <ul className="space-y-2">
              {recentTracks.map((t, i) => (
                <li key={`${t.trackId}-${t.playedAt}-${i}`} className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-cyan-950">
                    {t.albumArt && <img src={t.albumArt} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-wl-title">{t.name}</p>
                    <p className="truncate text-xs text-wl-muted">{t.artist}</p>
                  </div>
                  <span className="shrink-0 text-xs text-wl-faint">{timeAgo(t.playedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Public playlists */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-wl-link">Public playlists</h3>
          {playlistsError ? (
            <p className="text-xs text-wl-danger">{playlistsError}</p>
          ) : playlists.length === 0 ? (
            <p className="text-xs text-wl-muted">No public playlists on this account.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {playlists.map((p) => (
                <a
                  key={p.id}
                  href={p.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col items-center rounded-lg border border-cyan-500/10 bg-wl-bg p-2 text-center transition hover:border-cyan-500/30"
                >
                  <div className="mb-2 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cyan-950">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ListMusic className="h-5 w-5 text-cyan-500/50" />
                    )}
                  </div>
                  <p className="w-full truncate text-xs font-medium text-wl-title group-hover:text-wl-link">{p.name}</p>
                  {typeof p.trackCount === 'number' && p.trackCount > 0 && (
                    <p className="text-[11px] text-wl-faint">
                      {p.trackCount} {p.trackCount === 1 ? 'track' : 'tracks'}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Real Spotify identity */}
        <div className="pt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-wl-link">Connected to Spotify</h3>
          <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-wl-bg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
              {profile?.profileImage && <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-wl-soft">{profile?.displayName || 'Unknown'}</p>
              {/* As of Spotify's February 2026 Web API changes, /me no
                  longer returns email at all - not a scope issue, Spotify
                  just stopped providing it to any app. profile.email will
                  always be null now; kept in the type/response in case
                  Spotify ever reverses this. */}
              <p className="truncate text-xs text-wl-faint">
                {profile?.email || 'Spotify no longer shares account email with apps'}
              </p>
            </div>
            {profile?.profileUrl && (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-wl-fg/25 bg-wl-fg/10 px-3 py-1 text-xs text-wl-fg hover:bg-wl-fg/20"
              >
                <ExternalLink className="h-3 w-3" />
                View profile
              </a>
            )}
          </div>
        </div>

        {dirty && !saveError && (
          <p className="mt-3 text-center text-xs font-medium text-wl-treasure">
            You have unsaved changes to your nickname/bio.
          </p>
        )}
        {saveError && <p className="mt-3 text-center text-xs text-wl-danger">{saveError}</p>}
        <button
          onClick={() => void save()}
          disabled={saving}
          type="button"
          className={`mt-3 w-full rounded-md bg-wl-accent py-2.5 text-sm font-semibold text-black transition hover:bg-[#1fdf64] disabled:opacity-60 ${
            dirty ? 'animate-pulse ring-2 ring-wl-accent/60 ring-offset-2 ring-offset-wl-panel' : ''
          }`}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {showLeavePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-wl-scrim p-4 backdrop-blur-sm"
          onClick={() => setShowLeavePrompt(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-cyan-500/20 bg-wl-panel p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-wl-title">Save your changes?</h3>
            <p className="mt-1 text-sm text-wl-soft">
              You've edited your nickname or bio but haven't saved yet.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void saveAndLeave()}
                disabled={saving}
                className="rounded-md bg-wl-accent py-2 text-sm font-semibold text-black hover:bg-[#1fdf64] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save & leave'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-md border border-cyan-500/20 py-2 text-sm font-medium text-wl-danger hover:bg-cyan-500/10"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => setShowLeavePrompt(false)}
                className="rounded-md py-2 text-sm font-medium text-wl-link hover:bg-cyan-500/10"
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition-opacity ${toast ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        Profile saved
      </div>
      </div>
    </div>
  );
}
