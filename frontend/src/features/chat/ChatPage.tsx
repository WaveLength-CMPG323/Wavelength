import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../data/AuthContext';
import Conversation from './Conversation';
import CreateGroupPanel from './CreateGroupPanel';
import {
  fetchAcceptedChats,
  fetchGroupJoinRequests,
  fetchMyGroups,
  fetchPublicGroups,
  joinPublicGroup,
  leaveServerGroup,
  removeGroupMember,
  requestPrivateGroupJoin,
  respondToGroupJoinRequest,
  setGroupModerator,
} from '../../lib/api';
import type { AcceptedChat, ServerGroup } from '../../data/types';

type Active = { type: 'friend' | 'group'; id: string } | null;

export default function ChatPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const withId = params.get('with');
  const groupId = params.get('group');

  const [tab, setTab] = useState<'friends' | 'groups'>('friends');
  const [active, setActive] = useState<Active>(null);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);

  const [acceptedChats, setAcceptedChats] = useState<AcceptedChat[]>([]);
  const [chatError, setChatError] = useState('');
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<ServerGroup[]>([]);
  const [groupView, setGroupView] = useState<'joined' | 'discover'>('joined');
  const [groupError, setGroupError] = useState('');
  const [privateGroupId, setPrivateGroupId] = useState('');
  const [privateRequestStatus, setPrivateRequestStatus] = useState('');
  const [joinRequests, setJoinRequests] = useState<Array<{ spotifyUserId: string; requestedAt: number }>>([]);

  async function loadAcceptedChats() {
    try {
      setAcceptedChats(await fetchAcceptedChats());
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not load chats');
    }
  }

  async function loadMyGroups() {
    try {
      const [myGroups, discoverableGroups] = await Promise.all([
        fetchMyGroups(),
        fetchPublicGroups(),
      ]);
      setGroups(myGroups);
      setPublicGroups(discoverableGroups);
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not load groups');
    }
  }

  async function handleJoinPublicGroup(groupId: string) {
    try {
      const joinedGroup = await joinPublicGroup(groupId);
      setGroups((current) => [joinedGroup, ...current.filter((item) => item.id !== joinedGroup.id)]);
      setGroupView('joined');
      setActive({ type: 'group', id: joinedGroup.id });
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not join group');
    }
  }

  async function handlePrivateGroupRequest() {
    const groupId = privateGroupId.trim();
    if (!groupId) return;

    try {
      const result = await requestPrivateGroupJoin(groupId);
      setPrivateRequestStatus(result.status === 'already-member' ? 'You are already a member.' : 'Join request sent.');
      setPrivateGroupId('');
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not request group access');
    }
  }

  async function handleLeaveGroup(group: ServerGroup) {
    if (group.ownerSpotifyUserId === profile?.spotifyUserId) {
      setActive(null);
      return;
    }
    if (!confirm(`Leave "${group.name}"?`)) return;

    try {
      await leaveServerGroup(group.id);
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setActive(null);
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not leave group');
    }
  }

  async function handleLoadJoinRequests(groupId: string) {
    try {
      setJoinRequests(await fetchGroupJoinRequests(groupId));
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not load join requests');
    }
  }

  async function handleRespondToJoinRequest(groupId: string, requesterId: string, accept: boolean) {
    try {
      const updatedGroup = await respondToGroupJoinRequest(groupId, requesterId, accept);
      setGroups((current) => current.map((item) => item.id === updatedGroup.id ? updatedGroup : item));
      setJoinRequests((current) => current.filter((request) => request.spotifyUserId !== requesterId));
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not respond to join request');
    }
  }

  async function handleRemoveGroupMember(groupId: string, memberId: string) {
    if (!confirm(`Remove ${memberId} from this group?`)) return;

    try {
      const updatedGroup = await removeGroupMember(groupId, memberId);
      setGroups((current) => current.map((item) => item.id === updatedGroup.id ? updatedGroup : item));
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not remove member');
    }
  }

  async function handleSetModerator(groupId: string, memberId: string, isModerator: boolean) {
    try {
      const updatedGroup = await setGroupModerator(groupId, memberId, isModerator);
      setGroups((current) => current.map((item) => item.id === updatedGroup.id ? updatedGroup : item));
      setGroupError('');
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'Could not update member role');
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
    if (!groupId) return;

    const matchingGroup = groups.find((group) => group.id === groupId);
    if (matchingGroup) {
      setTab('groups');
      setGroupView('joined');
      setActive({ type: 'group', id: matchingGroup.id });
    }
  }, [groupId, groups]);

  useEffect(() => {
    void loadAcceptedChats();
  }, []);

  useEffect(() => {
    void loadMyGroups();
  }, []);

  const activeGroup = active?.type === 'group'
    ? groups.find((item) => item.id === active.id) ?? null
    : null;
  const myActiveGroupRole = activeGroup?.members.find(
    (member) => member.spotifyUserId === profile?.spotifyUserId
  )?.role;

  useEffect(() => {
    if (!activeGroup || (myActiveGroupRole !== 'owner' && myActiveGroupRole !== 'moderator')) {
      setJoinRequests([]);
      return;
    }
    void handleLoadJoinRequests(activeGroup.id);
  }, [activeGroup?.id, myActiveGroupRole]);

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
              onClick={() => { setTab('groups'); void loadMyGroups(); }}
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
                <div className="flex border-b border-cyan-500/20">
                  <button onClick={() => { setGroupView('joined'); void loadMyGroups(); }} type="button" className={`flex-1 py-2 text-xs font-medium ${groupView === 'joined' ? 'text-cyan-100' : 'text-slate-500'}`}>
                    Joined
                  </button>
                  <button onClick={() => setGroupView('discover')} type="button" className={`flex-1 py-2 text-xs font-medium ${groupView === 'discover' ? 'text-cyan-100' : 'text-slate-500'}`}>
                    Discover
                  </button>
                </div>
                {groupError && (
                  <div className="p-4">
                    <p className="text-xs text-red-400">{groupError}</p>
                    <button onClick={() => void loadMyGroups()} type="button" className="mt-2 text-xs text-cyan-300 underline">
                      Retry
                    </button>
                  </div>
                )}
                {privateRequestStatus && <p className="px-4 pt-3 text-xs text-cyan-300">{privateRequestStatus}</p>}
                {groupView === 'joined' && !groupError && groups.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No groups yet.</p>
                ) : groupView === 'joined' && !groupError ? (
                  groups.map((group) => {
                    return (
                      <button
                        key={group.id}
                        onClick={() => setActive({ type: 'group', id: group.id })}
                        type="button"
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cyan-500/10 ${active?.id === group.id ? 'bg-cyan-500/10' : ''}`}
                      >
                        <img src={group.icon ?? '/avatars/avatar4.svg'} alt={group.name} className="h-10 w-10 rounded-full object-cover" />
                        <span>
                          <span className="block text-sm font-medium text-cyan-100">{group.name}</span>
                          <span className="block text-xs text-slate-400">{group.members.length} members</span>
                        </span>
                      </button>
                    );
                  })
                ) : null}
                {groupView === 'discover' && !groupError && publicGroups.filter((group) => !groups.some((joined) => joined.id === group.id)).length === 0 && (
                  <p className="p-4 text-xs text-slate-500">No public groups to discover.</p>
                )}
                {groupView === 'discover' && !groupError && publicGroups
                  .filter((group) => !groups.some((joined) => joined.id === group.id))
                  .map((group) => (
                    <div key={group.id} className="flex items-center gap-3 border-b border-cyan-500/10 px-4 py-3">
                      <img src={group.icon ?? '/avatars/avatar4.svg'} alt={group.name} className="h-10 w-10 rounded-full object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-cyan-100">{group.name}</span>
                        <span className="block text-xs text-slate-400">{group.members.length} members</span>
                      </span>
                      <button onClick={() => void handleJoinPublicGroup(group.id)} type="button" className="text-xs font-semibold text-cyan-300 hover:text-cyan-100">
                        Join
                      </button>
                    </div>
                  ))}
                {groupView === 'discover' && (
                  <div className="mx-4 my-3 border-t border-cyan-500/20 pt-3">
                    <label htmlFor="private-group-id" className="mb-1 block text-xs text-slate-400">Have a private group ID?</label>
                    <div className="flex gap-2">
                      <input
                        id="private-group-id"
                        value={privateGroupId}
                        onChange={(event) => setPrivateGroupId(event.target.value)}
                        placeholder="Group ID"
                        className="min-w-0 flex-1 rounded-lg border border-cyan-500/20 bg-[#02182b] px-2 py-1.5 text-xs text-white"
                      />
                      <button onClick={() => void handlePrivateGroupRequest()} type="button" className="text-xs font-semibold text-cyan-300">
                        Request
                      </button>
                    </div>
                  </div>
                )}
                {groupView === 'joined' && (
                  <button
                    onClick={() => setGroupPanelOpen(true)}
                    type="button"
                    className="group m-3 rounded-none border-4 border-transparent bg-transparent py-2.5 text-sm font-semibold text-cyan-300 transition [border-image:repeating-linear-gradient(45deg,#0891b2_0_6px,transparent_6px_12px)_4] hover:text-[#1ED760] hover:[border-image:repeating-linear-gradient(45deg,#1ED760_0_6px,transparent_6px_12px)_4]"
                  >
                    + Create Group
                  </button>
                )}
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
                senderProfiles={{
                  [chat.spotifyUserId]: {
                    displayName: chat.displayName,
                    profileImage: chat.profileImage,
                  },
                }}
                menuLabel="Close chat"
                onMenuAction={() => setActive(null)}
              />
            );
          })()}

          {active?.type === 'group' && (() => {
            const group = activeGroup;
            if (!group) return null;

            return (
              <div className="flex h-full flex-col">
                <section className="border-b border-cyan-500/20 px-4 py-3">
                  <p className="text-sm font-semibold text-cyan-100">{group.name}</p>
                  {group.description && <p className="mt-1 text-xs text-slate-400">{group.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    {group.members.map((member) => (
                      <span key={member.spotifyUserId}>
                        {member.spotifyUserId === profile?.spotifyUserId ? 'You' : member.displayName}
                        <span className="ml-1 text-cyan-300">{member.role}</span>
                      </span>
                    ))}
                  </div>
                  {(myActiveGroupRole === 'owner' || myActiveGroupRole === 'moderator') && (
                    <div className="mt-3 border-t border-cyan-500/10 pt-2">
                      <p className="mb-1 text-xs font-semibold text-cyan-300">Membership requests</p>
                      {joinRequests.length === 0 ? (
                        <p className="text-xs text-slate-500">No pending requests.</p>
                      ) : joinRequests.map((request) => (
                        <div key={request.spotifyUserId} className="flex items-center gap-3 py-1 text-xs">
                          <span className="min-w-0 flex-1 truncate text-slate-300">{request.spotifyUserId}</span>
                          <button onClick={() => void handleRespondToJoinRequest(group.id, request.spotifyUserId, true)} type="button" className="text-emerald-300">Accept</button>
                          <button onClick={() => void handleRespondToJoinRequest(group.id, request.spotifyUserId, false)} type="button" className="text-red-300">Decline</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {myActiveGroupRole === 'owner' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.members.filter((member) => member.role !== 'owner').map((member) => (
                        <span key={member.spotifyUserId} className="flex items-center gap-1 text-xs text-slate-400">
                          {member.displayName}
                          <button
                            onClick={() => void handleSetModerator(group.id, member.spotifyUserId, member.role !== 'moderator')}
                            type="button"
                            className="text-cyan-300"
                          >
                            {member.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {(myActiveGroupRole === 'owner' || myActiveGroupRole === 'moderator') && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.members.filter((member) => member.role !== 'owner' && !(myActiveGroupRole === 'moderator' && member.role === 'moderator')).map((member) => (
                        <button key={member.spotifyUserId} onClick={() => void handleRemoveGroupMember(group.id, member.spotifyUserId)} type="button" className="text-xs text-red-300">
                          Remove {member.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
                <div className="min-h-0 flex-1">
                  <Conversation
                    isPrivateChat={false}
                    threadId={group.id}
                    title={group.name}
                    icon={group.icon ?? '/avatars/avatar4.svg'}
                    senderProfiles={Object.fromEntries(group.members.map((member) => [
                      member.spotifyUserId,
                      { displayName: member.displayName, profileImage: member.profileImage },
                    ]))}
                    menuLabel={group.ownerSpotifyUserId === profile?.spotifyUserId ? 'Close group' : 'Leave group'}
                    onMenuAction={() => void handleLeaveGroup(group)}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <CreateGroupPanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        onCreated={(group) => {
          setGroups((current) => [group, ...current.filter((item) => item.id !== group.id)]);
          setGroupView('joined');
          setTab('groups');
          setActive({ type: 'group', id: group.id });
        }}
      />
    </div>
  );
}
