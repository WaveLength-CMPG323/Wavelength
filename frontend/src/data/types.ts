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
  activeCosmeticEffect?: string | null;
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
  // The primary artist's genre tags (see backend/lib/genreCache.js) -
  // Spotify genres live on the ARTIST, not the track, so this is really
  // "this track's artist's genres". Can be empty (not every artist has
  // genres tagged, or the lookup hasn't completed/failed), never missing.
  genres: string[];
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
  // Cosmetic reward CSS class the host currently has equipped (see
  // backend/lib/oceanState.js's userEffects + routes/cosmetics.js's
  // POST /equip), or null if they have nothing equipped. Data plumbing
  // only - not yet drawn on the canvas-rendered bubbles (useOceanCanvas.ts).
  activeEffectCss?: string | null;
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
}

// GET /spotify/user/:spotifyUserId - another person's public profile (an
// ocean host), viewed read-only. No email (private, third parties never
// get it) and no recently-played (Spotify only exposes that for yourself).
export interface HostProfile {
  spotifyUserId: string;
  displayName: string;
  profileUrl: string | null;
  profileImage: string | null;
  // A nickname/bio this person has set for themselves on their own profile
  // page (see MyProfilePage) - null if they've never set one.
  nickname: string | null;
  bio: string | null;
  border?: string | null; // equipped border (css_class), see lib/borders.ts
}

// GET /chat-requests/incoming, POST /chat-requests - a request to start a
// chat, addressed to someone's real Spotify account. Chat itself isn't
// built yet; this is just the request/accept/decline mechanism.
export interface ChatRequest {
  id: string;
  fromSpotifyUserId: string;
  fromDisplayName: string | null;
  fromProfileImage: string | null;
  fromBorder?: string | null; // their equipped border (css_class), see lib/borders.ts
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

// GET /spotify/stats - follower/following counts and top genres for the
// profile page, derived from the Spotify account (not the mock Me.genres).
export interface ProfileStats {
  followers: number | null;
  following: number;
  topGenres: string[];
}

// GET /spotify/playlists (already filtered to public ones by the backend)
export interface PublicPlaylist {
  id: string;
  name: string;
  description: string;
  image: string | null;
  trackCount: number | null;
  url: string | null;
}

/* ---------- Real chat/group data (real backend, not MockApi) ----------
   See backend/routes/chatRequests.js (GET /chat-requests/accepted, POST
   /chat-requests/:id/revoke) and backend/routes/groups.js. Kept separate
   from the AppState/Group mock types above, which still back nickname/bio
   and the rest of the not-yet-real social features. */

// GET /chat-requests/accepted - a real chat "friend": someone with an
// accepted chat request in either direction.
export interface ChatFriend {
  requestId: string; // needed to call revokeChatRequest() ("Unfriend")
  spotifyUserId: string;
  displayName: string;
  profileImage: string | null;
  border?: string | null; // their equipped border (css_class), see lib/borders.ts
}

export interface RealGroupMember {
  spotifyUserId: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: number;
  displayName: string;
  profileImage: string | null;
  border?: string | null;
}

export interface RealGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: 'public' | 'private';
  ownerSpotifyUserId: string;
  createdAt?: number;
  members: RealGroupMember[];
}

// private:message / group:message socket events
export interface RealChatMessage {
  id: string;
  from: string; // spotifyUserId
  text: string;
  ts: number;
}

/* ---------- Weekly Challenges / Cosmetics (real backend) ----------
   See backend/routes/challenges.js and backend/routes/cosmetics.js. Kept
   separate from the mock Challenge/CatalogEntry types in mockData.ts,
   which still back the rest of the AppState plumbing (untouched by this
   feature) - only WeeklyChallengePanel.tsx reads these real types. */

// GET /challenges/active
export interface ActiveChallengeSubmission {
  trackId: string;
  title: string;
  artist: string;
  cover: string | null;
}

export interface ActiveChallenge {
  id: number | string;
  theme: string;
  description: string;
  rewardId: string | null;
  deadline: string; // ISO timestamp - when this challenge ends
  startedAt: string; // ISO timestamp - when this challenge began (countdown window = startedAt..deadline)
  mySubmission: ActiveChallengeSubmission | null;
  // Real count of rows in challenge_submissions for this challenge (see
  // GET /challenges/active) - kept live afterward via the 'challenge:update'
  // socket event broadcast from POST /challenges/submit, not by refetching.
  participantCount: number;
}

// GET /challenges/:id/entries - one row per person who joined, newest first.
export interface ChallengeEntry {
  spotifyUserId: string;
  displayName: string; // nickname if they set one, else their Spotify name
  profileImage: string | null;
  border?: string | null; // equipped border (css_class), see lib/borders.ts
  trackId: string;
  title: string;
  artist: string;
  cover: string | null;
  submittedAt: string; // ISO timestamp
  isMine: boolean;
}

// GET /challenges/search?q=...
export interface ChallengeSearchResult {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

// GET /cosmetics/inventory
export interface CosmeticItem {
  reward_id: string;
  name: string;
  description: string;
  effect_type: string;
  css_class: string;
  is_equipped: boolean;
  is_unlocked: boolean;
}
