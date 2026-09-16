import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import { tierFromFollowers } from '../../data/mockData';
import SongDetailsPanel from '../song-details/SongDetailsPanel';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { db, followUser, sendChatRequest } = useData();
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const user = id ? db.users[id] : undefined;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#02182b] text-white">
        <PageHeader title="Profile" />
        <p className="p-6 text-sm text-slate-400">User not found.</p>
      </div>
    );
  }

  const theirSongs = Object.values(db.songs).filter((s) => s.ownerId === user.id);
  const groupsCount = Object.values(db.groups).filter((g) => g.members.includes(user.id)).length;
  const username = user.name.toLowerCase().replace(/\s+/g, '.');

  return (
    <div className="min-h-screen bg-[#02182b] pb-16 text-white">
      <PageHeader title={user.name} />

      <div className="mx-auto my-8 max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#04385a]/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
        {/* Header: avatar, name, tier, actions */}
        <div className="flex flex-col items-center justify-between gap-6 border-b border-cyan-500/20 pb-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-cyan-400 bg-slate-300 shadow-md">
              <img src={user.pic} alt={user.name} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-2xl font-bold tracking-wide text-cyan-100">
                {user.name} <span className="text-sm font-normal text-cyan-400">@{username}</span>
              </h2>
              <div className="inline-block rounded border border-cyan-500/30 bg-cyan-950/80 px-2.5 py-0.5 text-xs text-cyan-300">
                Tier: {tierFromFollowers(user.followers)}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto shrink-0">
            <button
              onClick={() => followUser(user.id, !user.followedByMe)}
              type="button"
              className={`w-full rounded-md py-2 px-4 text-sm font-medium transition md:w-44 ${
                user.followedByMe
                  ? 'bg-slate-200 text-slate-900 hover:bg-white'
                  : 'border border-slate-700 bg-black text-white hover:bg-slate-900'
              }`}
            >
              {user.followedByMe ? 'Following' : 'Follow'}
            </button>
            {user.chatStatus === 'none' && (
              <button
                onClick={() => { sendChatRequest(user.id); setRequestSent(true); }}
                disabled={requestSent}
                type="button"
                className="w-full rounded-md bg-slate-200 py-2 px-4 text-sm font-medium text-slate-900 shadow transition hover:bg-white disabled:opacity-50 md:w-44"
              >
                {requestSent ? 'Request sent' : 'Send Chat Request'}
              </button>
            )}
            {user.chatStatus === 'friend' && (
              <a
                href={`/chat?with=${user.id}`}
                className="w-full rounded-md bg-slate-200 py-2 px-4 text-center text-sm font-medium text-slate-900 shadow transition hover:bg-white md:w-44"
              >
                Message
              </a>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-around border-b border-cyan-500/20 py-6 text-center">
          <div>
            <p className="text-xl font-bold text-cyan-100">{user.followers.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Followers</p>
          </div>
          <div>
            <p className="text-xl font-bold text-cyan-100">{user.following.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Following</p>
          </div>
          <div>
            <p className="text-xl font-bold text-cyan-100">{groupsCount}</p>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Groups</p>
          </div>
        </div>

        {/* Shared tracks grid */}
        <div className="pt-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-cyan-300">Shared Tracks</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {theirSongs.length === 0 && <p className="col-span-3 text-sm text-slate-400">No shared tracks yet.</p>}
            {theirSongs.map((song) => (
              <button
                key={song.id}
                onClick={() => setSelectedSong(song.id)}
                type="button"
                className="h-48 overflow-hidden rounded-lg shadow-inner"
              >
                <Cover song={song} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <SongDetailsPanel songId={selectedSong} onClose={() => setSelectedSong(null)} />
    </div>
  );
}
