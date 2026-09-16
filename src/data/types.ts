// Central data model. In the final system these mirror what the REST API /
// Socket.IO events return from PostgreSQL (see Technical Specification ->
// Database architecture -> Postgres tables). For now MockApi (mockData.ts)
// fills these shapes from localStorage so every component can already be
// written against the real shape.

export interface Song {
  id: string;
  title: string;
  artist: string;
  cover: string | null; // null => render a generated cover (mock-only Spotify search results)
  ownerId: string;
}

export type ChatStatus = 'none' | 'pending' | 'friend';

export interface AppUser {
  id: string;
  name: string;
  pic: string;
  followers: number;
  following: number;
  listening: string | null; // song id
  followedByMe: boolean;
  chatStatus: ChatStatus;
}

export interface Me {
  id: 'me';
  name: string;
  pic: string;
  genres: string[];
  nickname: string;
  bio: string;
  spotifyUsername: string;
  spotifyPic: string;
}

export interface ChatMessage {
  from: string; // 'me' | userId
  text: string;
  ts: number;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  description?: string;
  visibility?: 'public' | 'private';
  members: string[]; // user ids, 'me' included
}

export type NotificationStatus = 'pending' | 'accepted' | 'declined';

export interface AppNotification {
  id: string;
  userId: string;
  status: NotificationStatus;
}

export interface Challenge {
  theme: string;
  deadline: number; // epoch ms
  mySubmission: { songId: string } | null;
}

export interface CatalogEntry {
  title: string;
  artist: string;
}

export interface AppState {
  me: Me;
  users: Record<string, AppUser>;
  songs: Record<string, Song>;
  floaterOrder: string[];
  chats: Record<string, ChatMessage[]>;
  groups: Record<string, Group>;
  notifications: AppNotification[];
  hasNotifDot: boolean;
  hasChatDot: boolean;
  challenge: Challenge;
}
