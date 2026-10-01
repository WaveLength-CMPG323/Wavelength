// Fake backend for DEV preview mode (see devPreview.ts). Everything here
// mirrors the shapes in data/types.ts so components can't tell the
// difference. Never imported in production builds (guarded by PREVIEW_MODE).
import type { Socket } from 'socket.io-client';
import type { ChatRequest, HostProfile, OceanGroup, RecentTrack, SpotifyProfile } from '../data/types';

export const PREVIEW_PROFILE: SpotifyProfile = {
  spotifyUserId: 'preview-me',
  displayName: 'Preview User',
  profileUrl: null,
  email: 'preview@example.com',
  profileImage: '/avatars/avatar1.svg',
};

interface SeedTrack {
  id: string;
  name: string;
  artist: string;
  cover: string;
  durationMs: number;
  listeners: number;
  host: string;
  avatar: string;
  playing: boolean;
}

const SEED: SeedTrack[] = [
  { id: 'p1', name: 'Midnight Tide', artist: 'Coral Static', cover: '/covers/cover1.svg', durationMs: 214000, listeners: 5, host: 'Aiden', avatar: '/avatars/avatar2.svg', playing: true },
  { id: 'p2', name: 'Salt & Static', artist: 'The Low Harbours', cover: '/covers/cover2.svg', durationMs: 187000, listeners: 2, host: 'Naledi', avatar: '/avatars/avatar3.svg', playing: true },
  { id: 'p3', name: 'Deep Blue Sundays', artist: 'Kelp Forest', cover: '/covers/cover3.svg', durationMs: 242000, listeners: 8, host: 'Sam', avatar: '/avatars/avatar4.svg', playing: true },
  { id: 'p4', name: 'Undertow', artist: 'Marisol Vega', cover: '/covers/cover4.svg', durationMs: 199000, listeners: 1, host: 'Thandi', avatar: '/avatars/avatar5.svg', playing: false },
  { id: 'p5', name: 'Lighthouse', artist: 'Fathom', cover: '/covers/cover5.svg', durationMs: 226000, listeners: 3, host: 'Jordan', avatar: '/avatars/avatar6.svg', playing: true },
  { id: 'p6', name: 'Afterglow Reef', artist: 'Neon Anemone', cover: '/covers/cover6.svg', durationMs: 205000, listeners: 4, host: 'Lerato', avatar: '/avatars/avatar2.svg', playing: true },
];

const startedAt = Date.now();

function buildGroups(): OceanGroup[] {
  const now = Date.now();
  return SEED.map((t, i) => ({
    trackId: t.id,
    trackUri: `spotify:track:${t.id}`,
    trackName: t.name,
    artist: t.artist,
    albumArt: t.cover,
    isPlaying: t.playing,
    progressMs: ((now - startedAt) + i * 37000) % t.durationMs,
    durationMs: t.durationMs,
    lastPolledAt: now,
    firstSeenAt: startedAt,
    hostSessionId: `sess-${t.id}`,
    hostDisplayName: t.host,
    hostProfileUrl: null,
    hostSpotifyUserId: `preview-host-${t.id}`,
    hostProfileImage: t.avatar,
    listenerCount: t.listeners,
  }));
}

/* ---------------- fake Socket.IO ---------------- */

export function createPreviewSocket(): Socket {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Set<Handler>>();
  const emitLocal = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((h) => h(...args));

  // Same cadence as the real poller (~1s). Also fire once right away so
  // the ocean isn't empty for the first second.
  setTimeout(() => emitLocal('oceanUpdate', buildGroups()), 50);
  setInterval(() => emitLocal('oceanUpdate', buildGroups()), 1000);

  const fake = {
    connected: true,
    on(event: string, fn: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      return fake;
    },
    off(event: string, fn?: Handler) {
      if (fn) handlers.get(event)?.delete(fn);
      else handlers.delete(event);
      return fake;
    },
    emit: () => fake,
    disconnect: () => fake,
  };
  return fake as unknown as Socket;
}

/* ---------------- fake REST API ---------------- */

let followingHostSessionId: string | null = null;
const chatRequests: ChatRequest[] = [
  {
    id: 'cr1',
    fromSpotifyUserId: 'preview-host-p2',
    fromDisplayName: 'Naledi',
    fromProfileImage: '/avatars/avatar3.svg',
    toSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'cr2',
    fromSpotifyUserId: 'preview-host-p5',
    fromDisplayName: 'Jordan',
    fromProfileImage: '/avatars/avatar6.svg',
    toSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 90,
  },
];

const recentlyPlayed: RecentTrack[] = SEED.slice(0, 5).map((t, i) => ({
  trackId: t.id,
  trackUri: `spotify:track:${t.id}`,
  name: t.name,
  artist: t.artist,
  albumArt: t.cover,
  playedAt: new Date(Date.now() - i * 1000 * 60 * 17).toISOString(),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function previewFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const p = path.split('?')[0];

  if (p === '/auth/me') return json({ loggedIn: true, profile: PREVIEW_PROFILE });
  if (p === '/auth/logout') return json({ success: true });

  if (p === '/spotify/currently-playing') {
    const mine = SEED[0];
    return json({ playing: true, trackId: mine.id, track: mine.name, artist: mine.artist, albumArt: mine.cover, progressMs: 42000, durationMs: mine.durationMs });
  }
  if (p === '/spotify/join' && method === 'POST') return json({ success: true });
  if (p === '/spotify/follow' && method === 'POST') {
    followingHostSessionId = `sess-${body.trackId}`;
    return json({ success: true });
  }
  if (p === '/spotify/unfollow' && method === 'POST') {
    followingHostSessionId = null;
    return json({ success: true });
  }
  if (p === '/spotify/follow-status') return json({ followingHostSessionId });

  if (p.startsWith('/spotify/user/')) {
    const id = decodeURIComponent(p.replace('/spotify/user/', ''));
    const seed = SEED.find((t) => `preview-host-${t.id}` === id);
    const profile: HostProfile = {
      spotifyUserId: id,
      displayName: seed?.host ?? 'Preview Host',
      profileUrl: null,
      profileImage: seed?.avatar ?? '/avatars/avatar2.svg',
    };
    return json({ profile });
  }

  if (p === '/spotify/recently-played') return json({ items: recentlyPlayed });
  if (p === '/spotify/playlists') {
    return json({
      items: [
        { id: 'pl1', name: 'Late Night Drive', description: 'Windows down, volume up.', image: '/covers/cover2.svg', trackCount: 42, url: null },
        { id: 'pl2', name: 'Study Waves', description: 'Lo-fi and ambient.', image: '/covers/cover5.svg', trackCount: 87, url: null },
      ],
    });
  }
  if (['/spotify/play', '/spotify/pause', '/spotify/next', '/spotify/previous'].includes(p)) return json({ success: true });

  if (p === '/chat-requests' && method === 'POST') {
    return json({
      request: {
        id: 'cr' + Date.now(),
        fromSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
        fromDisplayName: PREVIEW_PROFILE.displayName,
        fromProfileImage: PREVIEW_PROFILE.profileImage,
        toSpotifyUserId: body.toSpotifyUserId,
        status: 'pending',
        createdAt: Date.now(),
      } satisfies ChatRequest,
    });
  }
  if (p === '/chat-requests/incoming') return json({ requests: chatRequests.filter((r) => r.status === 'pending') });
  const respond = p.match(/^\/chat-requests\/([^/]+)\/(accept|decline)$/);
  if (respond && method === 'POST') {
    const req = chatRequests.find((r) => r.id === decodeURIComponent(respond[1]));
    if (!req) return json({ error: 'Request not found' }, 404);
    req.status = respond[2] === 'accept' ? 'accepted' : 'declined';
    return json({ request: req });
  }

  return json({ error: `"${method} ${p}" isn't mocked in preview mode (add it to lib/previewData.ts)` }, 404);
}
