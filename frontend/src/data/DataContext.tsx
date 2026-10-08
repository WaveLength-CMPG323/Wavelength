import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppState, ChatStatus } from './types';
import * as api from './mockData';

// NOTE: real chat/group data (friends list, group membership, messages) now
// lives in ChatContext.tsx, backed by the real backend - see
// backend/routes/chatRequests.js and backend/routes/groups.js. This context
// keeps only what's still mock/local: nickname/bio, floaterOrder, the
// weekly challenge, and follow/chat-request bookkeeping used elsewhere
// (profile pages, notifications).

interface DataContextValue {
  db: AppState;
  // Generic escape hatch: mutate the db draft in place, then persist + re-render.
  mutate: (fn: (draft: AppState) => void) => void;
  followUser: (userId: string, follow: boolean) => void;
  sendChatRequest: (userId: string) => void;
  resolveNotification: (id: string, status: 'accepted' | 'declined') => void;
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

  return (
    <DataContext.Provider value={{ db, mutate, followUser, sendChatRequest, resolveNotification }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
