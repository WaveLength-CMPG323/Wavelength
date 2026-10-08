import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  fetchAcceptedChats,
  fetchMyGroups,
  fetchGroupMessages,
  fetchPrivateMessages,
  revokeChatRequest,
  createRealGroup,
  leaveRealGroup,
  addGroupMembers,
  kickGroupMember,
  setGroupModerator,
} from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import type { ChatFriend, RealGroup, RealChatMessage } from './types';

// Real chat/group data layer, backed by the Express + Socket.IO backend
// (backend/routes/chatRequests.js's /accepted + /:id/revoke,
// backend/routes/groups.js, and the private:*/group:* socket events in
// backend/server.js). Deliberately separate from DataContext/mockData,
// which still back nickname/bio/floaterOrder/challenge - none of that is
// part of this data source.
//
// Threads are keyed the same way the (already-restyled) chat UI expects:
// a friend's thread id is their spotifyUserId, a group's thread id is its
// group id.

interface ChatContextValue {
  friends: ChatFriend[];
  groups: RealGroup[];
  loading: boolean;
  messagesFor: (threadId: string) => RealChatMessage[];
  sendMessage: (threadId: string, text: string) => void;
  unfriend: (spotifyUserId: string) => Promise<void>;
  createGroup: (name: string, icon: string | null, memberSpotifyUserIds: string[]) => Promise<string>;
  leaveGroup: (groupId: string) => Promise<void>;
  // Group management (see GroupProfilePanel). Each applies the server's
  // updated group to local state straight away.
  addGroupMembers: (groupId: string, memberSpotifyUserIds: string[]) => Promise<void>;
  kickGroupMember: (groupId: string, spotifyUserId: string) => Promise<void>;
  setGroupModerator: (groupId: string, spotifyUserId: string, isModerator: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  // Unread tracking (client-side only, in-memory for the session - see
  // setActiveThread below for how a thread stops being "unread").
  unreadThreadIds: Set<string>;
  hasAnyUnread: boolean;
  setActiveThread: (threadId: string | null) => void;
  // Brief toast ("You were added to <group>", "You started chatting with
  // <name>", "You were removed from <group>"), surfaced from a global spot
  // (App.tsx) rather than only on /chat - see loadChats below for how a
  // newly-appeared group/friend triggers it. null means nothing is showing.
  newGroupNotice: string | null;
  dismissGroupNotice: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile } = useAuth();
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [groups, setGroups] = useState<RealGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Record<string, RealChatMessage[]>>({});
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<string>>(new Set());
  const [newGroupNotice, setNewGroupNotice] = useState<string | null>(null);
  const groupNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Which group ids we've already accounted for - null until the very
  // first successful loadChats() after login, which seeds it WITHOUT
  // firing a notice (so existing groups never "pop" one on initial load).
  // After that, any group id that shows up on a later poll tick that
  // isn't already in here is either one I just created myself (createGroup
  // adds it here immediately, see below) or one someone else added me to -
  // only the latter should ever reach this point.
  const seenGroupIdsRef = useRef<Set<string> | null>(null);
  // Same idea for friends: a friend id that appears after the first load is
  // a brand-new chat ("You started chatting with ...").
  const seenFriendIdsRef = useRef<Set<string> | null>(null);

  const dismissGroupNotice = useCallback(() => {
    if (groupNoticeTimerRef.current) {
      clearTimeout(groupNoticeTimerRef.current);
      groupNoticeTimerRef.current = null;
    }
    setNewGroupNotice(null);
  }, []);

  const showNotice = useCallback((message: string) => {
    if (groupNoticeTimerRef.current) clearTimeout(groupNoticeTimerRef.current);
    setNewGroupNotice(message);
    groupNoticeTimerRef.current = setTimeout(() => {
      setNewGroupNotice(null);
      groupNoticeTimerRef.current = null;
    }, 3500);
  }, []);

  // Keep latest friends/groups available inside socket callbacks/closures
  // without re-subscribing every render.
  const friendsRef = useRef(friends);
  friendsRef.current = friends;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const joinedPrivate = useRef<Set<string>>(new Set());
  const joinedGroups = useRef<Set<string>>(new Set());

  // Which thread (if any) ChatPage currently has open. A message for this
  // exact thread should never be marked unread - the user's already
  // looking at it. Set from ChatPage via setActiveThread whenever `active`
  // changes there (including clearing it on navigating away/back).
  const activeThreadRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  myUserIdRef.current = profile?.spotifyUserId ?? null;

  // Which threads we've already fetched history for this session - a
  // thread is only ever fetched once (on first becoming active), not on
  // every re-open, since live messages keep it up to date after that.
  const historyLoadedFor = useRef<Set<string>>(new Set());

  // Merges fetched history into messages[threadId] by id (so a message
  // that already arrived live via socket, before this fetch resolved,
  // isn't duplicated), sorted by ts ascending.
  const mergeHistory = useCallback((threadId: string, history: RealChatMessage[]) => {
    setMessages((prev) => {
      const existing = prev[threadId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const merged = [...existing, ...history.filter((m) => !existingIds.has(m.id))];
      merged.sort((a, b) => a.ts - b.ts);
      return { ...prev, [threadId]: merged };
    });
  }, []);

  const loadHistoryForThread = useCallback((threadId: string) => {
    if (historyLoadedFor.current.has(threadId)) return;
    historyLoadedFor.current.add(threadId);

    const isGroup = groupsRef.current.some((g) => g.id === threadId);
    const fetcher = isGroup ? fetchGroupMessages(threadId) : fetchPrivateMessages(threadId);
    fetcher
      .then((history) => mergeHistory(threadId, history))
      .catch((err) => {
        console.error(`Could not load message history for ${threadId}:`, err);
        historyLoadedFor.current.delete(threadId); // allow a retry on the next activation
      });
  }, [mergeHistory]);

  const setActiveThread = useCallback((threadId: string | null) => {
    activeThreadRef.current = threadId;
    if (!threadId) return;
    // Opening a thread marks it read immediately, regardless of whether it
    // had any unread messages.
    setUnreadThreadIds((prev) => {
      if (!prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
    loadHistoryForThread(threadId);
  }, [loadHistoryForThread]);

  // Marks a thread unread unless it's my own message coming back over the
  // socket (private:send/group:send both echo the sender's own message
  // back - that's never "unread" for the sender) or the thread the user
  // currently has open.
  const markUnread = useCallback((threadId: string, fromUserId: string) => {
    if (fromUserId === myUserIdRef.current) return;
    if (activeThreadRef.current === threadId) return;
    setUnreadThreadIds((prev) => {
      if (prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.add(threadId);
      return next;
    });
  }, []);

  const appendMessage = useCallback((threadId: string, message: RealChatMessage) => {
    setMessages((prev) => ({ ...prev, [threadId]: [...(prev[threadId] || []), message] }));
  }, []);

  // Fetches friends + groups and updates state - shared by the initial
  // load, the periodic poll below, and NotificationsPanel's "refresh right
  // after I accept a request" call. `showLoading` is only true for the
  // very first load, so background polls/refreshes don't flash a loading
  // state over an already-populated Chat page.
  const loadChats = useCallback((showLoading: boolean) => {
    if (showLoading) setLoading(true);
    return Promise.all([fetchAcceptedChats(), fetchMyGroups()])
      .then(([chats, myGroups]) => {
        setFriends(chats);
        setGroups(myGroups);

        const currentIds = new Set(myGroups.map((g) => g.id));
        const currentFriendIds = new Set(chats.map((f) => f.spotifyUserId));
        if (seenGroupIdsRef.current === null || seenFriendIdsRef.current === null) {
          // First load since login - just seed, never notify.
          seenGroupIdsRef.current = currentIds;
          seenFriendIdsRef.current = currentFriendIds;
        } else {
          const newlyAdded = myGroups.find((g) => !seenGroupIdsRef.current!.has(g.id));
          const newFriend = chats.find((f) => !seenFriendIdsRef.current!.has(f.spotifyUserId));
          seenGroupIdsRef.current = currentIds;
          seenFriendIdsRef.current = currentFriendIds;
          if (newlyAdded) showNotice(`You were added to ${newlyAdded.name}`);
          else if (newFriend) showNotice(`You started chatting with ${newFriend.displayName}`);
        }
      })
      .catch((err) => {
        console.error('Could not load chats/groups:', err);
      })
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, [showNotice]);

  // Load friends + groups whenever login status turns on; clear everything
  // when logged out.
  useEffect(() => {
    if (!isLoggedIn) {
      setFriends([]);
      setGroups([]);
      setMessages({});
      setUnreadThreadIds(new Set());
      joinedPrivate.current.clear();
      joinedGroups.current.clear();
      historyLoadedFor.current.clear();
      seenGroupIdsRef.current = null; // re-seed without notifying on next login
      seenFriendIdsRef.current = null;
      dismissGroupNotice();
      return;
    }

    loadChats(true);
  }, [isLoggedIn, loadChats, dismissGroupNotice]);

  // Poll for newly-accepted friends/groups every 8s while logged in - same
  // pattern as OceanNav's pending chat-request-count poll. Without this,
  // neither side of an accepted chat request sees the other show up until
  // a full page reload: NotificationsPanel manages its own separate
  // `requests` state and (aside from the immediate refresh() call below)
  // has no way to tell ChatContext "a friend was just added", and the
  // other person's browser has no push notification for it either.
  useEffect(() => {
    if (!isLoggedIn) return;
    const id = setInterval(() => {
      loadChats(false);
    }, 8000);
    return () => clearInterval(id);
  }, [isLoggedIn, loadChats]);

  const refresh = useCallback(() => loadChats(false), [loadChats]);

  // Subscribe to incoming message events once.
  useEffect(() => {
    const socket = getSocket();

    function onPrivateMessage(message: RealChatMessage & { to: string }) {
      // Thread id for a private chat is "the other person's spotifyUserId" -
      // whichever end of from/to isn't a friend I already know, prefer the
      // one that isn't in my own friends list check via `from` (I'm never
      // the thread id for my own view).
      const myFriendIds = new Set(friendsRef.current.map((f) => f.spotifyUserId));
      const otherId = myFriendIds.has(message.from) ? message.from : message.to;
      appendMessage(otherId, message);
      markUnread(otherId, message.from);
    }

    function onGroupMessage(message: RealChatMessage & { groupId: string }) {
      appendMessage(message.groupId, message);
      markUnread(message.groupId, message.from);
    }

    socket.on('private:message', onPrivateMessage);
    socket.on('group:message', onGroupMessage);
    return () => {
      socket.off('private:message', onPrivateMessage);
      socket.off('group:message', onGroupMessage);
    };
  }, [appendMessage, markUnread]);

  // Join a private room for every accepted friend once loaded. Acked (see
  // server.js's private:join handler) so a join that never actually lands
  // - e.g. emitted right as reauthSocket() is tearing the connection down
  // for a reconnect - gets noticed and retried, instead of the friend
  // being silently marked "joined" locally while the server never put this
  // socket in their room (which would otherwise mean private messages for
  // that thread never arrive live until some unrelated future reconnect).
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    for (const friend of friends) {
      if (joinedPrivate.current.has(friend.spotifyUserId)) continue;
      joinedPrivate.current.add(friend.spotifyUserId);
      socket.emit('private:join', { otherUserId: friend.spotifyUserId }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          console.error(`Could not join private room with ${friend.spotifyUserId}:`, ack?.error);
          joinedPrivate.current.delete(friend.spotifyUserId); // allow a retry on the next render
        }
      });
    }
  }, [friends, isLoggedIn]);

  // Join a room for every group once loaded.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    for (const group of groups) {
      if (joinedGroups.current.has(group.id)) continue;
      joinedGroups.current.add(group.id);
      socket.emit('group:join', { groupId: group.id }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          console.error(`Could not join group room ${group.id}:`, ack?.error);
          joinedGroups.current.delete(group.id); // allow a retry on the next render
        }
      });
    }
  }, [groups, isLoggedIn]);

  // Re-join rooms after a socket reconnect (e.g. reauthSocket() on
  // login/logout tore the connection down and brought it back up).
  useEffect(() => {
    const socket = getSocket();
    function onConnect() {
      joinedPrivate.current.clear();
      joinedGroups.current.clear();
      for (const friend of friendsRef.current) {
        joinedPrivate.current.add(friend.spotifyUserId);
        socket.emit('private:join', { otherUserId: friend.spotifyUserId }, (ack: { ok: boolean; error?: string }) => {
          if (!ack?.ok) {
            console.error(`Could not join private room with ${friend.spotifyUserId}:`, ack?.error);
            joinedPrivate.current.delete(friend.spotifyUserId);
          }
        });
      }
      for (const group of groupsRef.current) {
        joinedGroups.current.add(group.id);
        socket.emit('group:join', { groupId: group.id });
      }
    }
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, []);

  const messagesFor = useCallback((threadId: string) => messages[threadId] || [], [messages]);

  // Sender receives their own message back over the socket too: the
  // ported server broadcasts private:send via io.to(roomId).emit(...) and
  // the sender is in that room via private:join, and group:send loops
  // every socket in the room (including the sender's) via
  // fetchSockets()/emit(...) - so no optimistic local append is needed
  // here in either case.
  const sendMessage = useCallback((threadId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = getSocket();

    const isGroup = groupsRef.current.some((g) => g.id === threadId);
    if (isGroup) {
      socket.emit('group:send', { groupId: threadId, text: trimmed }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) console.error('Could not send group message:', ack?.error);
      });
    } else {
      socket.emit('private:send', { toUserId: threadId, text: trimmed });
    }
  }, []);

  const unfriend = useCallback(async (spotifyUserId: string) => {
    const friend = friendsRef.current.find((f) => f.spotifyUserId === spotifyUserId);
    if (!friend) return;
    await revokeChatRequest(friend.requestId);
    setFriends((prev) => prev.filter((f) => f.spotifyUserId !== spotifyUserId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[spotifyUserId];
      return next;
    });
    setUnreadThreadIds((prev) => {
      if (!prev.has(spotifyUserId)) return prev;
      const next = new Set(prev);
      next.delete(spotifyUserId);
      return next;
    });
    joinedPrivate.current.delete(spotifyUserId);
    historyLoadedFor.current.delete(spotifyUserId);
  }, []);

  const createGroup = useCallback(async (name: string, icon: string | null, memberSpotifyUserIds: string[]) => {
    const group = await createRealGroup(name, icon, memberSpotifyUserIds);
    setGroups((prev) => [...prev, group]);
    // Mark this group as already-seen immediately so the next poll tick
    // doesn't treat "a group I just made myself" as "I was added to a
    // group" and fire a spurious notice.
    seenGroupIdsRef.current?.add(group.id);
    const socket = getSocket();
    joinedGroups.current.add(group.id);
    socket.emit('group:join', { groupId: group.id });
    return group.id;
  }, []);

  // Forgets a group locally - used when I leave it or get removed from it.
  const dropGroupLocally = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setUnreadThreadIds((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
    seenGroupIdsRef.current?.delete(groupId);
    joinedGroups.current.delete(groupId);
    historyLoadedFor.current.delete(groupId);
    getSocket().emit('group:leave', { groupId });
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    await leaveRealGroup(groupId);
    dropGroupLocally(groupId);
  }, [dropGroupLocally]);

  // Swaps in the server's updated copy of a group (new roster/roles).
  const applyGroupUpdate = useCallback((updated: RealGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }, []);

  const addGroupMembersAction = useCallback(async (groupId: string, ids: string[]) => {
    applyGroupUpdate(await addGroupMembers(groupId, ids));
  }, [applyGroupUpdate]);

  const kickGroupMemberAction = useCallback(async (groupId: string, spotifyUserId: string) => {
    applyGroupUpdate(await kickGroupMember(groupId, spotifyUserId));
  }, [applyGroupUpdate]);

  const setGroupModeratorAction = useCallback(async (groupId: string, spotifyUserId: string, isModerator: boolean) => {
    applyGroupUpdate(await setGroupModerator(groupId, spotifyUserId, isModerator));
  }, [applyGroupUpdate]);

  // Live group changes pushed by the backend (backend/lib/groupEvents.js):
  // roster/role changes -> re-fetch; being kicked -> the group vanishes from
  // my chats immediately and I'm told why.
  useEffect(() => {
    const socket = getSocket();
    function onChanged() {
      void loadChats(false);
    }
    function onRemoved({ groupId }: { groupId: string }) {
      const group = groupsRef.current.find((g) => g.id === groupId);
      dropGroupLocally(groupId);
      if (group) showNotice(`You were removed from ${group.name}`);
    }
    socket.on('group:changed', onChanged);
    socket.on('group:removed', onRemoved);
    return () => {
      socket.off('group:changed', onChanged);
      socket.off('group:removed', onRemoved);
    };
  }, [loadChats, dropGroupLocally, showNotice]);

  // Someone equipped/unequipped a border: patch it into every place their
  // picture appears in my chats (friend list + group rosters) right away.
  useEffect(() => {
    const socket = getSocket();
    function onCosmeticChanged(payload: { spotifyUserId: string; isEquipped: boolean; cssClass: string | null }) {
      const border = payload.isEquipped ? payload.cssClass : null;
      setFriends((prev) =>
        prev.some((f) => f.spotifyUserId === payload.spotifyUserId)
          ? prev.map((f) => (f.spotifyUserId === payload.spotifyUserId ? { ...f, border } : f))
          : prev
      );
      setGroups((prev) =>
        prev.map((g) =>
          g.members.some((m) => m.spotifyUserId === payload.spotifyUserId)
            ? { ...g, members: g.members.map((m) => (m.spotifyUserId === payload.spotifyUserId ? { ...m, border } : m)) }
            : g
        )
      );
    }
    socket.on('user_cosmetic_changed', onCosmeticChanged);
    return () => {
      socket.off('user_cosmetic_changed', onCosmeticChanged);
    };
  }, []);

  const hasAnyUnread = unreadThreadIds.size > 0;

  // Clear any pending auto-dismiss timer on unmount (ChatProvider lives
  // for the whole app session, but this is cheap insurance regardless).
  useEffect(() => {
    return () => {
      if (groupNoticeTimerRef.current) clearTimeout(groupNoticeTimerRef.current);
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        friends,
        groups,
        loading,
        messagesFor,
        sendMessage,
        unfriend,
        createGroup,
        leaveGroup,
        addGroupMembers: addGroupMembersAction,
        kickGroupMember: kickGroupMemberAction,
        setGroupModerator: setGroupModeratorAction,
        refresh,
        unreadThreadIds,
        hasAnyUnread,
        setActiveThread,
        newGroupNotice,
        dismissGroupNotice,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
