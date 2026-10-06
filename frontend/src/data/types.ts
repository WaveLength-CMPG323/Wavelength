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
}

/* ---------- Live Spotify data (real backend, not MockApi) ----------
   These mirror what the Express/Socket.IO backend actually sends - see
   backend/lib/oceanState.js (computeGroups) and routes/auth.js (/auth/me).
   Kept separate from the AppState/Song mock types above, which still back
   the rest of the (not-yet-real) social features. */

// One bubble in the ocean: a track someone is currently listening to,
// grouped by track + deduped by real Spotify account so multiple tabs on
// the same account don't inflate the listener count.
export interface OceanGroup {
  trackId: string;
  trackUri: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  lastPolledAt: number; // Date.now() (server clock) at the last poll that updated this group
  firstSeenAt: number;
  hostSessionId: string;
  hostDisplayName: string | null;
  hostProfileUrl: string | null;
  hostSpotifyUserId: string | null;
  hostProfileImage: string | null;
  listenerCount: number;
}

// GET /spotify/currently-playing - my own playback, used for the player
// bar and to know which ocean bubble (if any) is "mine".
export interface MyPlayback {
  playing: boolean;
  trackId?: string;
  track?: string;
  artist?: string;
  albumArt?: string;
  progressMs?: number;
  durationMs?: number;
}

// GET /auth/me
export interface SpotifyProfile {
  spotifyUserId: string;
  displayName: string;
  profileUrl: string | null;
  email: string | null; // requires the user-read-email scope
  profileImage: string | null;
  // The weekly-challenge cosmetic they have switched on, or null.
  activeCosmetic?: Cosmetic | null;
}

// GET /spotify/user/:spotifyUserId - another person's public profile (an
// ocean host), viewed read-only. No email (private, third parties never
// get it) and no recently-played (Spotify only exposes that for yourself).
export interface HostProfile {
  spotifyUserId: string;
  displayName: string;
  profileUrl: string | null;
  profileImage: string | null;
  activeCosmetic?: Cosmetic | null;
}

// GET /chat-requests/incoming, POST /chat-requests - a request to start a
// chat, addressed to someone's real Spotify account. Chat itself isn't
// built yet; this is just the request/accept/decline mechanism.
export interface ChatRequest {
  id: string;
  fromSpotifyUserId: string;
  fromDisplayName: string | null;
  fromProfileImage: string | null;
  toSpotifyUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

// GET /spotify/recently-played
export interface RecentTrack {
  trackId: string;
  trackUri: string;
  name: string;
  artist: string;
  albumArt: string | null;
  playedAt: string; // ISO timestamp
}

// GET /spotify/playlists (already filtered to public ones by the backend)
export interface PublicPlaylist {
  id: string;
  name: string;
  description: string;
  image: string | null;
  trackCount: number;
  url: string | null;
}

/* ---------- Weekly challenges (real backend: backend/routes/challenges.js) ---------- */

// 'frame' = solid ring, 'glow' = ring + pulsing glow, 'ripple' = ring +
// expanding ripples. The backend owns the catalog and sends colours with
// every cosmetic, so a new cosmetic needs no frontend change.
export type CosmeticKind = 'frame' | 'glow' | 'ripple';

export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  kind: CosmeticKind;
  color: string;
  accent: string;
}

export interface ChallengeTrack {
  id: string;
  name: string | null;
  artist: string | null;
  albumArt: string | null;
}

export interface ChallengeCompletion {
  weekKey: string;
  challengeId: string;
  theme: string;
  completedAt: number; // epoch ms
  track: ChallengeTrack;
}

// GET /challenges/current
export interface CurrentChallenge {
  challenge: {
    id: string;
    theme: string;
    description: string;
    cosmetic: Cosmetic;
    weekKey: string;
    startsAt: number; // epoch ms
    endsAt: number; // epoch ms
  };
  serverNow: number; // server clock at response time, to correct for a wrong device clock
  participantCount: number;
  me: { completed: boolean; completion: ChallengeCompletion | null; ownsCosmetic: boolean } | null; // null = logged out
}

// GET /challenges/current/eligible-tracks - songs I can submit (heard this week)
export interface EligibleTrack {
  trackId: string;
  name: string;
  artist: string;
  albumArt: string | null;
  playedAt: string | null; // ISO; null for the song playing right now
  nowPlaying: boolean;
}

// POST /challenges/current/complete
export interface CompleteChallengeResult {
  completed: true;
  completion: ChallengeCompletion;
  cosmetic: Cosmetic;
  alreadyOwned: boolean; // a repeat from a later catalog cycle - nothing new unlocked
}

// GET /challenges/rewards - one entry per cosmetic I've collected
export interface ChallengeReward {
  cosmetic: Cosmetic;
  earnedAt: number; // epoch ms
  weekKey: string;
  theme: string;
  track: ChallengeTrack;
  timesEarned: number;
}

export interface RewardsResponse {
  rewards: ChallengeReward[];
  activeCosmeticId: string | null;
}
