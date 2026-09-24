import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Music2,
  Radio,
  UserPlus,
  X,
} from 'lucide-react';

import Cover from '../../components/Cover';
import { useData } from '../../data/DataContext';
import { useAuth } from '../../data/AuthContext';

export default function SongDetailsPanel({
  songId,
  onClose,
}: {
  songId: string | null;
  onClose: () => void;
}) {
  const {
    db,
    followUser,
    sendChatRequest,
  } = useData();

  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [listenAlong, setListenAlong] =
    useState(false);
  const [requestSent, setRequestSent] =
    useState(false);

  const song = songId
    ? db.songs[songId]
    : null;

  const owner = song
    ? song.ownerId === 'me'
      ? db.me
      : db.users[song.ownerId]
    : null;

  const isMe = song?.ownerId === 'me';

  function handleListenAlong() {
    if (!isLoggedIn) {
      onClose();
      navigate('/login');
      return;
    }

    setListenAlong((current) => !current);
  }

  function handleProfile() {
    if (!owner) return;

    onClose();

    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    navigate(
      isMe
        ? '/profile'
        : `/users/${owner.id}`
    );
  }

  return (
    <AnimatePresence>
      {song && owner && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#07102a]/65 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(event) =>
              event.stopPropagation()
            }
              className="song-details-scroll relative max-h-[90vh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-br from-[#4034a5]/95 via-[#285eb1]/95 to-[#137f9e]/95 p-6 text-white shadow-[0_24px_80px_rgba(5,10,40,0.45)] backdrop-blur-xl"            initial={{
              opacity: 0,
              scale: 0.95,
              y: 12,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 12,
            }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 300,
            }}
          >
            {/* Background glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />

            {/* Close */}
            <div className="relative flex justify-end">
              <button
                onClick={onClose}
                aria-label="Close"
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Album art */}
            <div className="relative mx-auto mt-1 h-48 w-48">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-purple-300/30 via-blue-300/25 to-cyan-300/30 blur-xl" />

              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/30 shadow-2xl">
                <Cover song={song} />
              </div>
            </div>

            {/* Song */}
            <div className="relative mt-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Now floating in the Ocean
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                {song.title}
              </h2>

              <p className="mt-1 text-sm text-white/60">
                {song.artist}
              </p>
            </div>

            {/* Host */}
            <button
              type="button"
              onClick={handleProfile}
              className="relative mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-3 text-left transition hover:bg-white/[0.13]"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/30 bg-white/10">
                {owner.pic ? (
                  <img
                    src={owner.pic}
                    alt={owner.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="h-5 w-5 text-white/60" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/40">
                  Host
                </p>

                <p className="truncate text-sm font-semibold text-white">
                  {owner.name}
                </p>
              </div>

              <span className="text-xs text-white/40">
                View profile
              </span>
            </button>

            {/* Primary actions */}
            <div className="relative mt-5 space-y-3">
              <a
                href="https://open.spotify.com"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#091533] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#111d43]"
              >
                <ExternalLink className="h-4 w-4 text-[#1ED760]" />
                Listen on Spotify
              </a>

              <button
                type="button"
                onClick={handleListenAlong}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 transition ${
                  listenAlong
                    ? 'border-cyan-200/50 bg-cyan-200/20'
                    : 'border-white/15 bg-white/[0.08] hover:bg-white/[0.13]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      listenAlong
                        ? 'bg-cyan-200 text-[#173b6f]'
                        : 'bg-white/10 text-cyan-100'
                    }`}
                  >
                    <Radio className="h-4 w-4" />
                  </div>

                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">
                      Listen Along
                    </p>

                    <p className="mt-0.5 text-[11px] text-white/45">
                      Follow the host's song changes
                    </p>
                  </div>
                </div>

                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    listenAlong
                      ? 'bg-cyan-200'
                      : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      listenAlong
                        ? 'left-6'
                        : 'left-1'
                    }`}
                  />
                </span>
              </button>

              {!isLoggedIn && (
                <p className="text-center text-[11px] text-white/45">
                  Log in with Spotify to listen
                  along with another user.
                </p>
              )}
            </div>

            {/* Secondary actions */}
            {isLoggedIn && (
              <div className="relative mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setLiked(
                      (current) => !current
                    )
                  }
                  className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
                    liked
                      ? 'bg-pink-500 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  <Heart
                    className="h-4 w-4"
                    fill={
                      liked
                        ? 'currentColor'
                        : 'none'
                    }
                  />

                  {liked ? 'Liked' : 'Like'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSaved(
                      (current) => !current
                    )
                  }
                  className={`rounded-full py-2.5 text-xs font-semibold transition ${
                    saved
                      ? 'bg-white text-[#3d2fb0]'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {saved
                    ? 'Saved ✓'
                    : 'Save to Spotify'}
                </button>
              </div>
            )}

            {/* Social actions */}
            {isLoggedIn &&
              !isMe &&
              'followedByMe' in owner && (
                <div className="relative mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      followUser(
                        owner.id,
                        !owner.followedByMe
                      )
                    }
                    className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition ${
                      owner.followedByMe
                        ? 'bg-white/10 text-white/70'
                        : 'bg-white text-[#3d2fb0]'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />

                    {owner.followedByMe
                      ? 'Following'
                      : 'Follow'}
                  </button>

                  {owner.chatStatus ===
                    'none' && (
                    <button
                      type="button"
                      onClick={() => {
                        sendChatRequest(
                          owner.id
                        );

                        setRequestSent(true);
                      }}
                      disabled={requestSent}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4" />

                      {requestSent
                        ? 'Request sent'
                        : 'Chat request'}
                    </button>
                  )}
                </div>
              )}

            {/* Spotify placeholder note */}
            <p className="relative mt-5 text-center text-[10px] text-white/30">
              Song metadata and artwork provided
              by Spotify
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}