import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useData } from '../../data/DataContext';
import Conversation from './Conversation';
import CreateGroupPanel from './CreateGroupPanel';
import { fetchAcceptedChats } from '../../lib/api';
import type { AcceptedChat } from '../../data/types';

type Active = { type: 'friend' | 'group'; id: string } | null;

export default function ChatPage() {
  const { db, leaveGroup } = useData();
  const [params] = useSearchParams();
  const withId = params.get('with');

  const [tab, setTab] = useState<'friends' | 'groups'>('friends');
  const [active, setActive] = useState<Active>(null);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);

  const [acceptedChats, setAcceptedChats] = useState<AcceptedChat[]>([]);
  const [chatError, setChatError] = useState('');

  async function loadAcceptedChats() {
    try {
      setAcceptedChats(await fetchAcceptedChats());
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not load chats');
    }
  }

  useEffect(() => {
    if (!withId) return;

    const matchingChat = acceptedChats.find(
      (chat) => chat.spotifyUserId === withId
    );

    if (matchingChat) {
      setActive({ type: 'friend', id: matchingChat.spotifyUserId });
    }
  }, [withId, acceptedChats]);

  useEffect(() => {
  void loadAcceptedChats();
  }, []);
  
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
              chatError ? (
                <div className="p-4">
                  <p className="text-xs text-red-400">{chatError}</p>
                  <button
                    onClick={() => void loadAcceptedChats()}
                    type="button"
                    className="mt-2 text-xs text-cyan-300 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : acceptedChats.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  No chats yet — accept a request from Notifications.
                </p>
              ) : (
                acceptedChats.map((chat) => {
                  const sub = 'Tap to chat';

                  return (
                    <button
                      key={chat.spotifyUserId}
                      onClick={() => setActive({ type: 'friend', id: chat.spotifyUserId })}
                      type="button"
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cyan-500/10 ${
                        active?.id === chat.spotifyUserId ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <img
                        src={chat.profileImage ?? '/avatars/avatar4.svg'}
                        alt={chat.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span>
                        <span className="block text-sm font-medium text-cyan-100">
                          {chat.displayName}
                        </span>
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
            const chat = acceptedChats.find(
              (item) => item.spotifyUserId === active.id
            );

            if (!chat) return null;

            return (
              <Conversation
                isPrivateChat={true}
                threadId={chat.spotifyUserId}
                title={chat.displayName}
                icon={chat.profileImage ?? '/avatars/avatar4.svg'}
                menuLabel="Close chat"
                onMenuAction={() => setActive(null)}
              />
            );
          })()}

          {active?.type === 'group' && (() => {
            const group = db.groups[active.id];
            return (
              <Conversation
                isPrivateChat={false}
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
