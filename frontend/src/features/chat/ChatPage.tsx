import { useState } from 'react';
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
    withId && db.users[withId]?.chatStatus === 'friend' ? { type: 'friend', id: withId } : null
  );
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);

  const friendIds = Object.keys(db.users).filter((id) => db.users[id].chatStatus === 'friend');
  const groupIds = Object.keys(db.groups);

  return (
    <div className="flex h-screen flex-col bg-[#02182b] text-white">
      <PageHeader title="Chat" />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r border-cyan-500/20">
          <div className="flex border-b border-cyan-500/20">
            <button
              onClick={() => setTab('friends')}
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${tab === 'friends' ? 'border-b-2 border-cyan-400 text-cyan-100' : 'text-slate-500'}`}
            >
              Friends
            </button>
            <button
              onClick={() => setTab('groups')}
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${tab === 'groups' ? 'border-b-2 border-cyan-400 text-cyan-100' : 'text-slate-500'}`}
            >
              Groups
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'friends' && (
              friendIds.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">No chats yet — accept a request from Notifications.</p>
              ) : (
                friendIds.map((id) => {
                  const user = db.users[id];
                  const sub = user.listening && db.songs[user.listening] ? `🎧 ${db.songs[user.listening].title}` : 'Tap to chat';
                  return (
                    <button
                      key={id}
                      onClick={() => setActive({ type: 'friend', id })}
                      type="button"
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cyan-500/10 ${active?.id === id ? 'bg-cyan-500/10' : ''}`}
                    >
                      <img src={user.pic} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                      <span>
                        <span className="block text-sm font-medium text-cyan-100">{user.name}</span>
                        <span className="block text-xs text-slate-400">{sub}</span>
                      </span>
                    </button>
                  );
                })
              )
            )}

            {tab === 'groups' && (
              <>
                {groupIds.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No groups yet.</p>
                ) : (
                  groupIds.map((id) => {
                    const group = db.groups[id];
                    return (
                      <button
                        key={id}
                        onClick={() => setActive({ type: 'group', id })}
                        type="button"
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cyan-500/10 ${active?.id === id ? 'bg-cyan-500/10' : ''}`}
                      >
                        <img src={group.icon} alt={group.name} className="h-10 w-10 rounded-full object-cover" />
                        <span>
                          <span className="block text-sm font-medium text-cyan-100">{group.name}</span>
                          <span className="block text-xs text-slate-400">{group.members.length} members</span>
                        </span>
                      </button>
                    );
                  })
                )}
                <button
                  onClick={() => setGroupPanelOpen(true)}
                  type="button"
                  className="group m-3 rounded-none border-4 border-transparent bg-transparent py-2.5 text-sm font-semibold text-cyan-300 transition [border-image:repeating-linear-gradient(45deg,#0891b2_0_6px,transparent_6px_12px)_4] hover:text-[#1ED760] hover:[border-image:repeating-linear-gradient(45deg,#1ED760_0_6px,transparent_6px_12px)_4]"
                >
                  + Create Group
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 bg-[#04385a]/40">
          {!active && <div className="flex h-full items-center justify-center text-sm text-slate-500">Pick a conversation to get started</div>}

          {active?.type === 'friend' && (() => {
            const user = db.users[active.id];
            return (
              <Conversation
                threadId={user.id}
                title={user.name}
                icon={user.pic}
                listeningSongTitle={user.listening ? db.songs[user.listening]?.title ?? null : null}
                onJoinListening={() => navigate(`/?song=${user.listening}`)}
                menuLabel="Unfriend"
                onMenuAction={() => {
                  if (confirm(`Unfriend and delete this chat with ${user.name}? This will also unfollow them.`)) {
                    unfriend(user.id);
                    setActive(null);
                  }
                }}
              />
            );
          })()}

          {active?.type === 'group' && (() => {
            const group = db.groups[active.id];
            return (
              <Conversation
                threadId={group.id}
                title={group.name}
                icon={group.icon}
                menuLabel="Leave group"
                onMenuAction={() => {
                  if (confirm(`Leave and delete "${group.name}"?`)) {
                    leaveGroup(group.id);
                    setActive(null);
                  }
                }}
              />
            );
          })()}
        </div>
      </div>

      <CreateGroupPanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        onCreated={(id) => { setTab('groups'); setActive({ type: 'group', id }); }}
      />
    </div>
  );
}
