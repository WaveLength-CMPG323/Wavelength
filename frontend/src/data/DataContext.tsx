import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppState, ChatStatus } from './types';
import * as api from './mockData';
import { useAuth } from './AuthContext';
import { getSocket } from '../lib/socket';

interface DataContextValue {
  db: AppState;
  // Generic escape hatch: mutate the db draft in place, then persist + re-render.
  mutate: (fn: (draft: AppState) => void) => void;
  followUser: (userId: string, follow: boolean) => void;
  sendChatRequest: (userId: string) => void;
  resolveNotification: (id: string, status: 'accepted' | 'declined') => void;
  unfriend: (userId: string) => void;
  createGroup: (name: string, icon: string, memberIds: string[]) => string;
  leaveGroup: (groupId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppState>(() => api.rolloverChallengeIfNeeded(api.load()));
  const { profile } = useAuth();


const mutate = useCallback((fn: (draft: AppState) => void) => {
  setDb((prev) => {
    const draft = structuredClone(prev);
    fn(draft);
    api.save(draft);
    return draft;
  });
}, []);
  
useEffect(() => {
  // Wait until the signed-in user's Spotify ID is available.
  if (!profile?.spotifyUserId) return;

  // Get the socket connected with this user's identity.
  const socket = getSocket(profile.spotifyUserId);

  // Handle each private message received from the backend.
  const handlePrivateMessage = (message: {
    id?: string;
    from: string;
    to: string;
    text: string;
    ts: number;
  }) => {
    // Use the other participant's ID as the chat's thread key.
    const threadId = message.from === profile.spotifyUserId ? message.to : message.from;

    mutate((draft) => {
      const existing = draft.chats[threadId] || [];

      draft.chats[threadId] = [
        ...existing,
        {
          from: message.from === profile.spotifyUserId ? 'me' : message.from,
          text: message.text,
          ts: message.ts,
        },
      ].sort((a, b) => a.ts - b.ts);
    });
  };

  // Start listening for private messages.
  socket.on('private:message', handlePrivateMessage);

  return () => {
    // Stop listening when this effect is cleaned up.
    socket.off('private:message', handlePrivateMessage);
  };
}, [profile?.spotifyUserId, mutate]);


  const followUser = useCallback((userId: string, follow: boolean) => {
    mutate((d) => { d.users[userId].followedByMe = follow; });
  }, [mutate]);

  const sendChatRequest = useCallback((userId: string) => {
    mutate((d) => {
      d.users[userId].chatStatus = 'pending' as ChatStatus;
      d.notifications.push({ id: 'n' + Date.now(), userId, status: 'pending' });
    });
  }, [mutate]);

  const resolveNotification = useCallback((id: string, status: 'accepted' | 'declined') => {
    mutate((d) => {
      const n = d.notifications.find((n) => n.id === id);
      if (!n) return;
      n.status = status;
      if (status === 'accepted') {
        d.users[n.userId].chatStatus = 'friend';
        if (!d.chats[n.userId]) d.chats[n.userId] = [];
      }
    });
  }, [mutate]);

  const unfriend = useCallback((userId: string) => {
    mutate((d) => {
      d.users[userId].chatStatus = 'none';
      d.users[userId].followedByMe = false;
      delete d.chats[userId];
    });
  }, [mutate]);

  const createGroup = useCallback((name: string, icon: string, memberIds: string[]) => {
    const id = 'g' + Date.now();
    mutate((d) => {
      d.groups[id] = { id, name, icon, members: ['me', ...memberIds] };
      d.chats[id] = [];
    });
    return id;
  }, [mutate]);

  const leaveGroup = useCallback((groupId: string) => {
    mutate((d) => {
      delete d.groups[groupId];
      delete d.chats[groupId];
    });
  }, [mutate]);

  return (
    <DataContext.Provider value={{ db, mutate, followUser, sendChatRequest, resolveNotification, unfriend, createGroup, leaveGroup }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
