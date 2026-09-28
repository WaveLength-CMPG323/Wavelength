import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppState, ChatStatus } from './types';
import * as api from './mockData';

interface DataContextValue {
  db: AppState;
  // Generic escape hatch: mutate the db draft in place, then persist + re-render.
  mutate: (fn: (draft: AppState) => void) => void;
  followUser: (userId: string, follow: boolean) => void;
  sendChatRequest: (userId: string) => void;
  resolveNotification: (id: string, status: 'accepted' | 'declined') => void;
  sendMessage: (threadId: string, text: string) => void;
  unfriend: (userId: string) => void;
  createGroup: (name: string, icon: string, memberIds: string[]) => string;
  leaveGroup: (groupId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppState>(() => api.rolloverChallengeIfNeeded(api.load()));

  // Stand-in for the Socket.IO context described in the spec: in the real
  // app this effect would instead subscribe to socket events. Here it just
  // re-reads localStorage periodically so multiple tabs/pages stay in sync.
  useEffect(() => {
    const id = setInterval(() => setDb(api.load()), 4000);
    return () => clearInterval(id);
  }, []);

  const mutate = useCallback((fn: (draft: AppState) => void) => {
    setDb((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      api.save(draft);
      return draft;
    });
  }, []);

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

  const sendMessage = useCallback((threadId: string, text: string) => {
    if (!text.trim()) return;
    mutate((d) => {
      if (!d.chats[threadId]) d.chats[threadId] = [];
      d.chats[threadId].push({ from: 'me', text: text.trim(), ts: Date.now() });
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
    <DataContext.Provider value={{ db, mutate, followUser, sendChatRequest, resolveNotification, sendMessage, unfriend, createGroup, leaveGroup }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
