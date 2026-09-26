import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useData } from '../../data/DataContext';
import { tierLabel } from '../../data/mockData';
import { Sparkles } from 'lucide-react';

export default function MyProfilePage() {
  const { db, mutate } = useData();
  const { me } = db;
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(me.bio);
  const [genreInput, setGenreInput] = useState('');
  const [toast, setToast] = useState(false);

  const groupsCount = Object.values(db.groups).filter((g) => g.members.includes('me')).length;

  const activeProfileEffect = db.user?.activeProfileEffect;
  const activeMarkerEffect = db.user?.activeMarkerEffect;

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
        {/* Header: Avatar with dynamic profile effect + tier + editable fields */}
        <div className="flex flex-col items-center gap-6 border-b border-cyan-500/20 pb-6 sm:flex-row sm:items-start">
          
          {/* Avatar Container with Active Aura/Cosmetics */}
          <div className="relative shrink-0">
            {/* Abyssal Sunken Aura Effect */}
            {activeProfileEffect === 'abyssal-aura' && (
              <div className="absolute -inset-2.5 animate-pulse rounded-full bg-gradient-to-tr from-cyan-400 via-sky-300 to-amber-300 opacity-80 blur-md" />
            )}

            {/* Golden Tide Halo Effect */}
            {activeProfileEffect === 'golden-tide' && (
              <div className="absolute -inset-2.5 animate-pulse rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 opacity-90 blur-md" />
            )}

            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
              {me.pic ? (
                <img src={me.pic} alt="Your profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-slate-800">
                  {me.nickname?.[0] || 'ME'}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-block rounded border border-cyan-500/30 bg-cyan-950/80 px-2.5 py-0.5 text-xs text-cyan-300">
                Tier: {tierLabel(me.genres.length)}
              </div>

              {/* Active Effect Indicator */}
              {(activeProfileEffect || activeMarkerEffect) && (
                <div className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  <span>Cosmetics Active</span>
                </div>
              )}
            </div>

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

        {/* Active Cosmetics Section */}
        <div className="border-b border-cyan-500/20 py-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">
            Equipped Ocean Cosmetics
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-500/20 bg-[#02182b] p-3 text-xs">
              <span className="text-slate-400">Profile Aura: </span>
              <span className="font-semibold text-white">
                {activeProfileEffect ? activeProfileEffect.replace('-', ' ').toUpperCase() : 'None'}
              </span>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-[#02182b] p-3 text-xs">
              <span className="text-slate-400">Song Marker Effect: </span>
              <span className="font-semibold text-white">
                {activeMarkerEffect ? activeMarkerEffect.replace('-', ' ').toUpperCase() : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Genre pills */}
        <div className="pt-6">
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

        {/* Spotify-locked identity */}
        <div className="pt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">Connected from Spotify</h3>
          <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-[#02182b] px-3 py-2">
            <img src={me.spotifyPic} alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="flex-1 text-sm text-slate-300">@{me.spotifyUsername}</span>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">SYNCED · NOT EDITABLE</span>
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