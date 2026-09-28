// Thin client for the real backend (Express + Socket.IO, see /backend).
// Every request is same-site-with-credentials so the `connect.sid` session
// cookie set by /auth/callback rides along - that cookie is how the
// backend knows which Spotify account/session is asking. See socket.ts for
// the companion Socket.IO connection used for live 'oceanUpdate' events.
import type { ChatRequest, HostProfile, MyPlayback, PublicPlaylist, RecentTrack, SpotifyProfile } from '../data/types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  await apiFetch('/auth/logout');
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
// session id - used to correctly restore the panel's toggle state.
export async function fetchFollowStatus(): Promise<{ followingHostSessionId: string | null }> {
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
