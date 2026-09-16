import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';

export default function SongDetailsPanel({ songId, onClose }: { songId: string | null; onClose: () => void }) {
  const { db, followUser, sendChatRequest } = useData();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const song = songId ? db.songs[songId] : null;
  const owner = song ? (song.ownerId === 'me' ? db.me : db.users[song.ownerId]) : null;
  const isMe = song?.ownerId === 'me';

  return (
    <AnimatePresence>
      {song && owner && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl border border-cyan-500/20 bg-[#04385a] p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <button onClick={onClose} aria-label="Close" className="self-end text-cyan-300/70 hover:text-cyan-200" type="button">
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto h-44 w-44 overflow-hidden rounded-xl shadow-lg"><Cover song={song} /></div>

            <div className="text-center">
              <div className="text-lg font-semibold text-cyan-100">{song.title}</div>
              <div className="text-sm text-slate-400">{song.artist}</div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <img src={owner.pic} alt={owner.name} className="h-8 w-8 rounded-full object-cover" />
              <span className="text-sm font-medium text-cyan-200">
                {'listening' in owner && owner.listening ? 'Listening now' : owner.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://open.spotify.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#1ED760] py-2 text-center text-sm font-semibold text-black hover:bg-[#1fdf64]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Listen on Spotify
              </a>
              <button
                disabled={!isLoggedIn}
                onClick={() => setSaved((s) => !s)}
                className={`rounded-full py-2 text-sm font-semibold disabled:opacity-40 ${saved ? 'bg-cyan-400 text-slate-950' : 'bg-cyan-500/10 text-cyan-200'}`}
                type="button"
              >
                {saved ? 'Saved ✓' : 'Save to Spotify'}
              </button>
              <button
                disabled={!isLoggedIn}
                onClick={() => setLiked((l) => !l)}
                className={`rounded-full py-2 text-sm font-semibold disabled:opacity-40 ${liked ? 'bg-pink-500 text-white' : 'bg-cyan-500/10 text-cyan-200'}`}
                type="button"
              >
                {liked ? 'Liked ♥' : 'Like'}
              </button>
              <button
                onClick={() => { onClose(); navigate(isLoggedIn ? (isMe ? '/profile' : `/users/${owner.id}`) : '/login'); }}
                className="rounded-full bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-200"
                type="button"
              >
                View profile
              </button>
            </div>

            {!isLoggedIn && (
              <button
                onClick={() => { onClose(); navigate('/login'); }}
                type="button"
                className="rounded-full bg-white/10 py-2 text-sm font-semibold text-white"
              >
                Log in to save, like &amp; follow
              </button>
            )}

            {isLoggedIn && !isMe && 'followedByMe' in owner && (
              <div className="flex gap-2">
                <button
                  onClick={() => followUser(owner.id, !owner.followedByMe)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold ${owner.followedByMe ? 'bg-cyan-500/10 text-cyan-200' : 'bg-[#1ED760] text-black'}`}
                  type="button"
                >
                  {owner.followedByMe ? 'Following' : 'Follow'}
                </button>
                {owner.chatStatus === 'none' && (
                  <button
                    onClick={() => { sendChatRequest(owner.id); setRequestSent(true); }}
                    disabled={requestSent}
                    className="flex-1 rounded-full bg-white/10 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    type="button"
                  >
                    {requestSent ? 'Request sent' : 'Send chat request'}
                  </button>
                )}
              </div>
            )}

            <p className="text-center text-[11px] text-slate-500">Metadata &amp; artwork via Spotify</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
