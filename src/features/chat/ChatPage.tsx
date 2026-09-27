import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useData } from '../../data/DataContext';
import Conversation from './Conversation';
import CreateGroupPanel from './CreateGroupPanel';

type Active = { type: 'friend' | 'group'; id: string } | null;

export default function ChatPage() {
  const { db, unfriend, leaveGroup } = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const withId = params.get('with');

  const [tab, setTab] = useState<'friends' | 'groups'>('friends');

  const [active, setActive] = useState<Active>(
    withId && db.users[withId]?.chatStatus === 'friend'
      ? { type: 'friend', id: withId }
      : null
  );

  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [showThread, setShowThread] = useState(Boolean(withId));

  const friendIds = Object.keys(db.users).filter(
    (id) => db.users[id].chatStatus === 'friend'
  );

  const groupIds = Object.keys(db.groups);

  function selectFriend(id: string) {
    setActive({ type: 'friend', id });
    setShowThread(true);
  }

  function selectGroup(id: string) {
    setActive({ type: 'group', id });
    setShowThread(true);
  }

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-[#0a192f] text-white">

      {/* Underwater atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        {/* Deep ocean gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a2140] via-[#071c3d] to-[#031426]" />

        {/* Soft underwater glow */}
        <div className="absolute -left-32 top-16 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-[120px]" />

        {/* Light rays */}
        <div className="absolute -top-40 left-[15%] h-[700px] w-32 rotate-[18deg] bg-gradient-to-b from-cyan-200/[0.08] to-transparent blur-xl" />

        <div className="absolute -top-40 left-[45%] h-[650px] w-44 rotate-[14deg] bg-gradient-to-b from-blue-200/[0.06] to-transparent blur-2xl" />

        <div className="absolute -top-40 right-[12%] h-[700px] w-28 rotate-[20deg] bg-gradient-to-b from-cyan-200/[0.05] to-transparent blur-xl" />

        {/* Floating bubbles */}
        <motion.span
          className="absolute bottom-[12%] left-[8%] h-2 w-2 rounded-full border border-cyan-200/20 bg-cyan-200/5"
          animate={{
            y: [0, -90],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[18%] left-[38%] h-3 w-3 rounded-full border border-cyan-200/15 bg-cyan-200/5"
          animate={{
            y: [0, -120],
            x: [0, 8, -4],
            opacity: [0, 0.45, 0],
          }}
          transition={{
            duration: 11,
            delay: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[8%] right-[20%] h-1.5 w-1.5 rounded-full border border-cyan-200/20"
          animate={{
            y: [0, -100],
            x: [0, -6, 3],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 9,
            delay: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[28%] right-[7%] h-2.5 w-2.5 rounded-full border border-cyan-200/15"
          animate={{
            y: [0, -80],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 10,
            delay: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Shared WaveLength secondary header */}
      <div className="relative z-10">
        <PageHeader title="Chat" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-5 pb-5 pt-4">
        {/* Sidebar */}
        <aside
          className={`${
            showThread ? 'hidden' : 'flex'
          } w-full flex-col overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#071330]/55 shadow-[0_16px_50px_rgba(2,10,25,0.35)] backdrop-blur-xl md:flex md:w-[320px] md:shrink-0`}        >

          {/* Friends / Groups tabs */}
          <nav className="flex border-b border-white/10 text-sm font-medium">
            {(['friends', 'groups'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`relative flex-1 py-4 capitalize transition ${
                  tab === item
                    ? 'text-white'
                    : 'text-white/45 hover:text-white/75'
                }`}
              >
                {item}

                {tab === item && (
                  <motion.span
                    layoutId="chat-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-300"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 40,
                    }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar heading */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              {tab === 'groups' ? 'Your groups' : 'Friends'}
            </span>

            {tab === 'groups' && (
              <button
                type="button"
                onClick={() => setGroupPanelOpen(true)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                + New group
              </button>
            )}
          </div>

          {/* Conversation list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'friends' && (
              <>
                {friendIds.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-white/40">
                    No chats yet — accept a request from Notifications.
                  </p>
                )}

                {friendIds.map((id) => {
                  const user = db.users[id];

                  const listening =
                    user.listening && db.songs[user.listening]
                      ? db.songs[user.listening].title
                      : null;

                  const selected =
                    active?.type === 'friend' && active.id === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectFriend(id)}
                      
                      className={`
                        mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3
                        rounded-xl border px-3 py-3 text-left
                        transition duration-200
                        ${
                          selected
                            ? 'border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.10)]'
                            : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      <img
                        src={user.pic}
                        alt={user.name}
                        className={`h-11 w-11 shrink-0 rounded-full border object-cover transition ${
                          selected
                            ? 'border-cyan-300/60 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                            : 'border-white/10'
                        }`}                      
                        />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-white">
                          {user.name}
                        </span>

                        <span
                          className={`flex items-center gap-1 truncate text-xs ${
                            listening
                              ? 'text-cyan-100/80'
                              : 'text-white/40'
                          }`}
                        >
                          {listening && <span aria-hidden>🎧</span>}

                          <span className="truncate">
                            {listening ?? 'Tap to chat'}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {tab === 'groups' && (
              <>
                {groupIds.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-white/40">
                    No groups yet.
                  </p>
                )}

                {groupIds.map((id) => {
                  const group = db.groups[id];

                  const selected =
                    active?.type === 'group' && active.id === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectGroup(id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        selected
                          ? 'bg-cyan-400/15'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <img
                        src={group.icon}
                        alt={group.name}
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-white">
                          {group.name}
                        </span>

                        <span className="block truncate text-xs text-white/40">
                          {group.members.length} members
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Conversation area */}
        <main
          className={`${
            showThread ? 'flex' : 'hidden'
          } min-w-0 flex-1 overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#071330]/35 shadow-[0_16px_50px_rgba(2,10,25,0.3)] backdrop-blur-xl md:flex`}
        >
          {!active && (
            <div className="hidden flex-1 items-center justify-center bg-[#071c3d]/35 text-sm text-white/40 md:flex">
              Pick a conversation to get started
            </div>
          )}

          {active?.type === 'friend' &&
            (() => {
              const user = db.users[active.id];

              return (
                <Conversation
                  threadId={user.id}
                  title={user.name}
                  icon={user.pic}
                  listeningSongTitle={
                    user.listening
                      ? db.songs[user.listening]?.title ?? null
                      : null
                  }
                  onJoinListening={() =>
                    navigate(`/?song=${user.listening}`)
                  }
                  onBack={() => setShowThread(false)}
                  menuLabel="Unfriend"
                  onMenuAction={() => {
                    if (
                      confirm(
                        `Unfriend and delete this chat with ${user.name}? This will also unfollow them.`
                      )
                    ) {
                      unfriend(user.id);
                      setActive(null);
                      setShowThread(false);
                    }
                  }}
                />
              );
            })()}

          {active?.type === 'group' &&
            (() => {
              const group = db.groups[active.id];

              return (
                <Conversation
                  threadId={group.id}
                  title={group.name}
                  icon={group.icon}
                  onBack={() => setShowThread(false)}
                  menuLabel="Leave group"
                  onMenuAction={() => {
                    if (confirm(`Leave and delete "${group.name}"?`)) {
                      leaveGroup(group.id);
                      setActive(null);
                      setShowThread(false);
                    }
                  }}
                />
              );
            })()}
        </main>
      </div>

      <CreateGroupPanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        onCreated={(id) => {
          setTab('groups');
          setActive({ type: 'group', id });
          setShowThread(true);
        }}
      />
    </div>
  );
}