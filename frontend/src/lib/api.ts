// Thin client for the real backend (Express + Socket.IO, see /backend).
// Identity rides along as an `Authorization: Bearer <token>` header, not a
// cookie - the frontend and backend are on two different *.onrender.com
// subdomains, which browsers treat as separate sites, so a cookie here
// would be a third-party cookie and get silently blocked by a growing
// share of browsers (Safari and Firefox always, Chrome increasingly) no
// matter how it's configured. The token itself is handed to us once, via
// the URL after the OAuth redirect lands back here (see
// src/data/AuthContext.tsx), and kept in localStorage from then on. See
// socket.ts for the companion Socket.IO connection used for live
// 'oceanUpdate' events (that one's just a public broadcast, no auth).
import type { ActiveChallenge, ActiveChallengeSubmission, ChallengeEntry, ChallengeSearchResult, ChatFriend, ChatRequest, CosmeticItem, HostProfile, MyPlayback, ProfileStats, PublicPlaylist, RealChatMessage, RealGroup, RecentTrack, SpotifyProfile } from '../data/types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_STORAGE_KEY = 'wl_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null; // localStorage can throw in some privacy modes - just treat as logged out
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Nothing sensible to do if storage is unavailable - the user will
    // just need to log in again next visit.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  return fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
}

// Extracts the backend's { error: "..." } message from a failed response,
// falling back to a generic message if the body isn't JSON or has none.
async function errorFrom(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

// Full-page redirect target for "Connect with Spotify" - not a fetch call,
// since the OAuth dance needs real browser navigation (to Spotify, then
// back). See backend/routes/auth.js#/login.
export function spotifyLoginUrl(): string {
  return `${API_URL}/auth/login`;
}

export async function fetchMe(): Promise<{ loggedIn: boolean; profile: SpotifyProfile | null }> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) return { loggedIn: false, profile: null };
  return res.json();
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout');
  } finally {
    // This is what actually logs the browser out - the backend has no
    // server-side identity to clear anymore (see backend/lib/identity.js).
    clearStoredToken();
  }
}

export async function fetchCurrentlyPlaying(): Promise<MyPlayback> {
  const res = await apiFetch('/spotify/currently-playing');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not fetch currently-playing data'));
  return res.json();
}

export async function joinTrack(trackUri: string, trackId: string): Promise<{ success: true; alreadyListening?: boolean }> {
  const res = await apiFetch('/spotify/join', {
    method: 'POST',
    body: JSON.stringify({ trackUri, trackId }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not join this song'));
  return res.json();
}

export async function followHost(trackId: string): Promise<{ success: true }> {
  const res = await apiFetch('/spotify/follow', {
    method: 'POST',
    body: JSON.stringify({ trackId }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not update Follow Along'));
  return res.json();
}

export async function unfollowHost(): Promise<{ success: true }> {
  const res = await apiFetch('/spotify/unfollow', { method: 'POST' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not update Follow Along'));
  return res.json();
}

// Which host (if any) I'm currently Following Along with, keyed by their
// session id - used to correctly restore the panel's toggle state. Also
// carries the last background-sync error, if the poller's been unable to
// actually move my playback onto the host's track (e.g. no Premium, no
// active device) - that used to only ever show up in the backend's own
// logs, so Follow Along could look "on" while silently doing nothing.
export async function fetchFollowStatus(): Promise<{ followingHostSessionId: string | null; lastError: string | null }> {
  const res = await apiFetch('/spotify/follow-status');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not check Follow Along status'));
  return res.json();
}

// A host's read-only Wavelength profile: their public Spotify identity
// (name, avatar, profile link). No playlists here - Spotify permanently
// removed the "get another user's playlists" endpoint in Feb 2026, so
// there's no longer any way to fetch anyone's playlists but your own.
export async function fetchHostProfile(spotifyUserId: string): Promise<{ profile: HostProfile }> {
  const res = await apiFetch(`/spotify/user/${encodeURIComponent(spotifyUserId)}`);
  if (!res.ok) throw new Error(await errorFrom(res, "Could not load this person's profile"));
  return res.json();
}

// Saves the logged-in person's own nickname/bio - shown on their own
// profile page, on their public profile (fetchHostProfile above), and
// preferred over their Spotify display name in chats/friends/groups.
export async function saveProfileDetails(nickname: string, bio: string): Promise<{ nickname: string | null; bio: string | null }> {
  const res = await apiFetch('/spotify/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname, bio }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not save your nickname/bio'));
  return res.json();
}

export async function fetchRecentlyPlayed(): Promise<RecentTrack[]> {
  const res = await apiFetch('/spotify/recently-played');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not fetch recently played tracks'));
  const body = await res.json();
  return body.items;
}

export async function fetchPublicPlaylists(): Promise<PublicPlaylist[]> {
  const res = await apiFetch('/spotify/playlists');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not fetch playlists'));
  const body = await res.json();
  return body.items;
}

// Follower/following counts and top genres for the profile page.
export async function fetchProfileStats(): Promise<ProfileStats> {
  const res = await apiFetch('/spotify/stats');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not fetch profile stats'));
  return res.json();
}

// Sends a chat request to someone else's real Spotify account. Chat
// itself isn't built yet - this just creates the pending request they'll
// see in their Notifications.
export async function sendChatRequest(toSpotifyUserId: string): Promise<ChatRequest> {
  const res = await apiFetch('/chat-requests', {
    method: 'POST',
    body: JSON.stringify({ toSpotifyUserId }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not send chat request'));
  const body = await res.json();
  return body.request;
}

export async function fetchIncomingChatRequests(): Promise<ChatRequest[]> {
  const res = await apiFetch('/chat-requests/incoming');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load notifications'));
  const body = await res.json();
  return body.requests;
}

export async function respondToChatRequest(id: string, accept: boolean): Promise<ChatRequest> {
  const res = await apiFetch(`/chat-requests/${encodeURIComponent(id)}/${accept ? 'accept' : 'decline'}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not respond to chat request'));
  const body = await res.json();
  return body.request;
}

export async function resumePlayback(): Promise<void> {
  const res = await apiFetch('/spotify/play', { method: 'PUT' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not resume playback'));
}

export async function pausePlayback(): Promise<void> {
  const res = await apiFetch('/spotify/pause', { method: 'PUT' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not pause playback'));
}

export async function skipNext(): Promise<void> {
  const res = await apiFetch('/spotify/next', { method: 'POST' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not skip to next track'));
}

export async function skipPrevious(): Promise<void> {
  const res = await apiFetch('/spotify/previous', { method: 'POST' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not skip to previous track'));
}

// Saves a track to the user's Liked Songs (Spotify's saved-tracks library).
export async function saveTrackToLibrary(trackId: string): Promise<void> {
  const res = await apiFetch('/spotify/save-track', {
    method: 'PUT',
    body: JSON.stringify({ trackId }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not save this song'));
}

// --- Real chat/groups (backend/routes/chatRequests.js, backend/routes/groups.js) ---

export async function fetchAcceptedChats(): Promise<ChatFriend[]> {
  const res = await apiFetch('/chat-requests/accepted');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load your chats'));
  const body = await res.json();
  return body.chats;
}

export async function revokeChatRequest(requestId: string): Promise<void> {
  const res = await apiFetch(`/chat-requests/${encodeURIComponent(requestId)}/revoke`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not unfriend this person'));
}

export async function fetchMyGroups(): Promise<RealGroup[]> {
  const res = await apiFetch('/groups/mine');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load your groups'));
  const body = await res.json();
  return body.groups;
}

// Creates a private group (no "browse public groups" feature in this app
// yet) with the given members added directly, matching CreateGroupPanel's
// "pick friends up front" UX.
export async function createRealGroup(
  name: string,
  icon: string | null,
  memberSpotifyUserIds: string[]
): Promise<RealGroup> {
  const res = await apiFetch('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, icon, visibility: 'private', memberSpotifyUserIds }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not create group'));
  const body = await res.json();
  return body.group;
}

export async function leaveRealGroup(groupId: string): Promise<void> {
  const res = await apiFetch(`/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not leave group'));
}

// The group routes answer with short codes for refused actions - turn them
// into something a person can read.
const GROUP_ERROR_TEXT: Record<string, string> = {
  forbidden: "You don't have permission to do that.",
  'moderator-cannot-remove-moderator': 'Moderators can only remove regular members.',
  'cannot-remove-owner': "The admin can't be removed.",
  'member-not-found': 'That person is no longer in the group.',
  'not-found': 'This group no longer exists.',
};

async function groupErrorFrom(res: Response, fallback: string): Promise<string> {
  const message = await errorFrom(res, fallback);
  return GROUP_ERROR_TEXT[message] ?? message;
}

// Admin only: add friends to an existing group. Returns the updated group.
export async function addGroupMembers(groupId: string, memberSpotifyUserIds: string[]): Promise<RealGroup> {
  const res = await apiFetch(`/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberSpotifyUserIds }),
  });
  if (!res.ok) throw new Error(await groupErrorFrom(res, 'Could not add people to this group'));
  return (await res.json()).group;
}

// Admin, or a moderator for regular members only. Returns the updated group.
export async function kickGroupMember(groupId: string, spotifyUserId: string): Promise<RealGroup> {
  const res = await apiFetch(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(spotifyUserId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(await groupErrorFrom(res, 'Could not remove this person'));
  return (await res.json()).group;
}

// Admin only: make someone a moderator, or take it away again.
export async function setGroupModerator(groupId: string, spotifyUserId: string, isModerator: boolean): Promise<RealGroup> {
  const res = await apiFetch(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(spotifyUserId)}/moderator`,
    { method: 'PATCH', body: JSON.stringify({ isModerator }) }
  );
  if (!res.ok) throw new Error(await groupErrorFrom(res, 'Could not change this role'));
  return (await res.json()).group;
}

// Message history (backend/db/chatHistory.js, loaded once per thread by
// ChatContext.tsx the first time that thread becomes active - live
// messages after that keep arriving over the private:message/group:message
// socket events handled elsewhere).

export async function fetchPrivateMessages(otherUserId: string): Promise<RealChatMessage[]> {
  const res = await apiFetch(`/chat-requests/${encodeURIComponent(otherUserId)}/messages`);
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load message history'));
  const body = await res.json();
  return body.messages;
}

export async function fetchGroupMessages(groupId: string): Promise<RealChatMessage[]> {
  const res = await apiFetch(`/groups/${encodeURIComponent(groupId)}/messages`);
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load message history'));
  const body = await res.json();
  return body.messages;
}

// --- Weekly Challenges / Cosmetics (backend/routes/challenges.js, backend/routes/cosmetics.js) ---

// GET /challenges/active - no active challenge (404) resolves to null
// rather than throwing, since that's an ordinary, expected state (e.g.
// between challenges), not an error.
export async function fetchActiveChallenge(): Promise<ActiveChallenge | null> {
  const res = await apiFetch('/challenges/active');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load this week’s challenge'));
  return res.json();
}

// Everyone's entries to one challenge (including your own), newest first.
export async function fetchChallengeEntries(challengeId: string | number): Promise<ChallengeEntry[]> {
  const res = await apiFetch(`/challenges/${encodeURIComponent(String(challengeId))}/entries`);
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load challenge entries'));
  const body = await res.json();
  return body.entries;
}

export async function searchChallengeTracks(query: string): Promise<ChallengeSearchResult[]> {
  const res = await apiFetch(`/challenges/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not search Spotify'));
  const body = await res.json();
  return body.results;
}

// Theme-validation failures (and other submit errors) need to reach the
// UI as a real message, not be swallowed - the thrown Error's message is
// always the server's own `error` string when available.
export async function submitChallengeEntry(
  challengeId: string | number,
  trackId: string
): Promise<{
  success: true;
  submission: ActiveChallengeSubmission;
  // Submitting also tries to start the track playing on the submitter's
  // own Spotify right now (see backend/routes/challenges.js) - that's
  // what actually makes it show up as a bubble in the ocean, since the
  // ocean only ever reflects live currently-playing polls. This can fail
  // independently of the submission itself (no Premium, no active
  // device) without the submission failing.
  playbackStarted: boolean;
  playbackError: string | null;
}> {
  const res = await apiFetch('/challenges/submit', {
    method: 'POST',
    body: JSON.stringify({ challengeId, trackId }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not submit challenge entry'));
  return res.json();
}

export async function fetchCosmeticsInventory(): Promise<CosmeticItem[]> {
  const res = await apiFetch('/cosmetics/inventory');
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not load your cosmetics'));
  const body = await res.json();
  return body.cosmetics;
}

export async function equipCosmetic(rewardId: string, isEquipped: boolean): Promise<void> {
  const res = await apiFetch('/cosmetics/equip', {
    method: 'POST',
    body: JSON.stringify({ rewardId, isEquipped }),
  });
  if (!res.ok) throw new Error(await errorFrom(res, 'Could not update this cosmetic'));
}
