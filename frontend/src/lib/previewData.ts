// Fake backend for DEV preview mode (see devPreview.ts). Everything here
// mirrors the shapes in data/types.ts so components can't tell the
// difference. Never imported in production builds (guarded by PREVIEW_MODE).
import type { Socket } from "socket.io-client";
import type {
  ChallengeCompletion,
  ChallengeReward,
  ChatRequest,
  Cosmetic,
  CurrentChallenge,
  EligibleTrack,
  HostProfile,
  OceanGroup,
  RecentTrack,
  RewardsResponse,
  SpotifyProfile,
} from "../data/types";

export const PREVIEW_PROFILE: SpotifyProfile = {
  spotifyUserId: "preview-me",
  displayName: "Preview User",
  profileUrl: null,
  email: "preview@example.com",
  profileImage: "/avatars/avatar1.svg",
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
  {
    id: "p1",
    name: "Midnight Tide",
    artist: "Coral Static",
    cover: "/covers/cover1.svg",
    durationMs: 214000,
    listeners: 1,
    host: "Aiden",
    avatar: "/avatars/avatar2.svg",
    playing: true,
  },
  {
    id: "p2",
    name: "Salt & Static",
    artist: "The Low Harbours",
    cover: "/covers/cover2.svg",
    durationMs: 187000,
    listeners: 1,
    host: "Naledi",
    avatar: "/avatars/avatar3.svg",
    playing: true,
  },
  {
    id: "p3",
    name: "Deep Blue Sundays",
    artist: "Kelp Forest",
    cover: "/covers/cover3.svg",
    durationMs: 242000,
    listeners: 1,
    host: "Sam",
    avatar: "/avatars/avatar4.svg",
    playing: true,
  },
  {
    id: "p4",
    name: "Undertow",
    artist: "Marisol Vega",
    cover: "/covers/cover4.svg",
    durationMs: 199000,
    listeners: 1,
    host: "Thandi",
    avatar: "/avatars/avatar5.svg",
    playing: false,
  },
  {
    id: "p5",
    name: "Lighthouse",
    artist: "Fathom",
    cover: "/covers/cover5.svg",
    durationMs: 226000,
    listeners: 1,
    host: "Jordan",
    avatar: "/avatars/avatar6.svg",
    playing: true,
  },
  {
    id: "p6",
    name: "Afterglow Reef",
    artist: "Neon Anemone",
    cover: "/covers/cover6.svg",
    durationMs: 205000,
    listeners: 1,
    host: "Lerato",
    avatar: "/avatars/avatar2.svg",
    playing: true,
  },
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
    progressMs: (now - startedAt + i * 37000) % t.durationMs,
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
  const emitLocal = (event: string, ...args: unknown[]) =>
    handlers.get(event)?.forEach((h) => h(...args));

  // Same cadence as the real poller (~1s). Also fire once right away so
  // the ocean isn't empty for the first second.
  setTimeout(() => emitLocal("oceanUpdate", buildGroups()), 50);
  setInterval(() => emitLocal("oceanUpdate", buildGroups()), 1000);

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
    id: "cr1",
    fromSpotifyUserId: "preview-host-p2",
    fromDisplayName: "Naledi",
    fromProfileImage: "/avatars/avatar3.svg",
    toSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
    status: "pending",
    createdAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "cr2",
    fromSpotifyUserId: "preview-host-p5",
    fromDisplayName: "Jordan",
    fromProfileImage: "/avatars/avatar6.svg",
    toSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
    status: "pending",
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
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/* ---------------- fake weekly challenges ---------------- */
// Mirrors backend/routes/challenges.js. State lives in memory, so a page
// reload resets it (same as the rest of preview mode). Handy states to try:
// complete the challenge, equip a past reward, switch it off again.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const PREVIEW_COSMETICS: Record<string, Cosmetic> = {
  "tide-ring": { id: "tide-ring", name: "Tide Ring", description: "A clean ring of rolling tide.", kind: "frame", color: "#22d3ee", accent: "#0ea5e9" },
  "coral-glow": { id: "coral-glow", name: "Coral Glow", description: "A warm pulse, straight off the reef.", kind: "glow", color: "#fb7185", accent: "#f97316" },
  "moonlit-ripple": { id: "moonlit-ripple", name: "Moonlit Ripple", description: "Moonlight spreading across still water.", kind: "ripple", color: "#c4b5fd", accent: "#818cf8" },
};

// Monday 00:00 UTC of the current week, like the real getWeek().
function previewWeek() {
  const d = new Date();
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  const startsAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday);
  return { startsAt, endsAt: startsAt + WEEK_MS, weekKey: new Date(startsAt).toISOString().slice(0, 10) };
}

const PREVIEW_CHALLENGE = {
  id: "hidden-gem",
  theme: "Hidden Gem",
  description: "Share an underrated artist you think deserves more ears.",
  cosmetic: PREVIEW_COSMETICS["moonlit-ripple"],
};

function previewTrack(i: number) {
  const t = SEED[i];
  return { id: t.id, name: t.name, artist: t.artist, albumArt: t.cover };
}

// Two past weeks already earned, so the rewards panel has something in it.
const previewRewards: ChallengeReward[] = [
  {
    cosmetic: PREVIEW_COSMETICS["coral-glow"],
    earnedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    weekKey: new Date(previewWeek().startsAt - WEEK_MS).toISOString().slice(0, 10),
    theme: "Lost in Translation",
    track: previewTrack(1),
    timesEarned: 1,
  },
  {
    cosmetic: PREVIEW_COSMETICS["tide-ring"],
    earnedAt: Date.now() - 1000 * 60 * 60 * 24 * 16,
    weekKey: new Date(previewWeek().startsAt - 2 * WEEK_MS).toISOString().slice(0, 10),
    theme: "Childhood Soundtrack",
    track: previewTrack(2),
    timesEarned: 1,
  },
];
let previewCompletion: ChallengeCompletion | null = null;
let previewActiveCosmeticId: string | null = null;

const activePreviewCosmetic = (): Cosmetic | null =>
  (previewActiveCosmeticId && PREVIEW_COSMETICS[previewActiveCosmeticId]) || null;

const previewEligibleTracks = (): EligibleTrack[] =>
  SEED.slice(0, 5).map((t, i) => ({
    trackId: t.id,
    name: t.name,
    artist: t.artist,
    albumArt: t.cover,
    playedAt: i === 0 ? null : new Date(Date.now() - i * HOUR_MS * 5).toISOString(),
    nowPlaying: i === 0,
  }));

function previewChallengeFetch(p: string, method: string, body: Record<string, unknown>): Response | null {
  if (p === "/challenges/current") {
    const week = previewWeek();
    const result: CurrentChallenge = {
      challenge: { ...PREVIEW_CHALLENGE, weekKey: week.weekKey, startsAt: week.startsAt, endsAt: week.endsAt },
      serverNow: Date.now(),
      participantCount: 37 + (previewCompletion ? 1 : 0),
      me: {
        completed: !!previewCompletion,
        completion: previewCompletion,
        ownsCosmetic: previewRewards.some((r) => r.cosmetic.id === PREVIEW_CHALLENGE.cosmetic.id),
      },
    };
    return json(result);
  }

  if (p === "/challenges/current/eligible-tracks") return json({ tracks: previewEligibleTracks() });

  if (p === "/challenges/current/complete" && method === "POST") {
    if (previewCompletion) {
      return json({ error: "You’ve already completed this week’s challenge", completion: previewCompletion }, 409);
    }
    const track = previewEligibleTracks().find((t) => t.trackId === body.trackId);
    if (!track) {
      return json({ error: "We couldn’t find that song in your listening this week. Play it on Spotify, then try again." }, 400);
    }
    const week = previewWeek();
    previewCompletion = {
      weekKey: week.weekKey,
      challengeId: PREVIEW_CHALLENGE.id,
      theme: PREVIEW_CHALLENGE.theme,
      completedAt: Date.now(),
      track: { id: track.trackId, name: track.name, artist: track.artist, albumArt: track.albumArt },
    };
    previewRewards.unshift({
      cosmetic: PREVIEW_CHALLENGE.cosmetic,
      earnedAt: previewCompletion.completedAt,
      weekKey: week.weekKey,
      theme: PREVIEW_CHALLENGE.theme,
      track: previewCompletion.track,
      timesEarned: 1,
    });
    return json({ completed: true, completion: previewCompletion, cosmetic: PREVIEW_CHALLENGE.cosmetic, alreadyOwned: false });
  }

  if (p === "/challenges/rewards") {
    const result: RewardsResponse = { rewards: previewRewards, activeCosmeticId: previewActiveCosmeticId };
    return json(result);
  }

  if (p === "/challenges/active-cosmetic" && method === "PUT") {
    const id = body.cosmeticId;
    if (id !== null && typeof id !== "string") return json({ error: "cosmeticId must be a string or null" }, 400);
    if (id !== null && !previewRewards.some((r) => r.cosmetic.id === id)) {
      return json({ error: "You haven’t unlocked that reward yet" }, 403);
    }
    previewActiveCosmeticId = id;
    return json({ activeCosmetic: activePreviewCosmetic() });
  }

  return null;
}

export async function previewFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const p = path.split("?")[0];

  if (p === "/auth/me")
    return json({
      loggedIn: true,
      profile: { ...PREVIEW_PROFILE, activeCosmetic: activePreviewCosmetic() },
    });
  if (p === "/auth/logout") return json({ success: true });

  if (p.startsWith("/challenges/")) {
    const res = previewChallengeFetch(p, method, body);
    if (res) return res;
  }

  if (p === "/spotify/currently-playing") {
    const mine = SEED[0];
    return json({
      playing: true,
      trackId: mine.id,
      track: mine.name,
      artist: mine.artist,
      albumArt: mine.cover,
      progressMs: 42000,
      durationMs: mine.durationMs,
    });
  }
  if (p === "/spotify/join" && method === "POST")
    return json({ success: true });
  if (p === "/spotify/follow" && method === "POST") {
    followingHostSessionId = `sess-${body.trackId}`;
    return json({ success: true });
  }
  if (p === "/spotify/unfollow" && method === "POST") {
    followingHostSessionId = null;
    return json({ success: true });
  }
  if (p === "/spotify/follow-status") return json({ followingHostSessionId });

  if (p.startsWith("/spotify/user/")) {
    const id = decodeURIComponent(p.replace("/spotify/user/", ""));
    const seed = SEED.find((t) => `preview-host-${t.id}` === id);
    const profile: HostProfile = {
      spotifyUserId: id,
      displayName: seed?.host ?? "Preview Host",
      profileUrl: null,
      profileImage: seed?.avatar ?? "/avatars/avatar2.svg",
    };
    return json({ profile });
  }

  if (p === "/spotify/recently-played") return json({ items: recentlyPlayed });
  if (p === "/spotify/playlists") {
    return json({
      items: [
        {
          id: "pl1",
          name: "Late Night Drive",
          description: "Windows down, volume up.",
          image: "/covers/cover2.svg",
          trackCount: 42,
          url: null,
        },
        {
          id: "pl2",
          name: "Study Waves",
          description: "Lo-fi and ambient.",
          image: "/covers/cover5.svg",
          trackCount: 87,
          url: null,
        },
      ],
    });
  }
  if (
    [
      "/spotify/play",
      "/spotify/pause",
      "/spotify/next",
      "/spotify/previous",
    ].includes(p)
  )
    return json({ success: true });

  if (p === "/chat-requests" && method === "POST") {
    return json({
      request: {
        id: "cr" + Date.now(),
        fromSpotifyUserId: PREVIEW_PROFILE.spotifyUserId,
        fromDisplayName: PREVIEW_PROFILE.displayName,
        fromProfileImage: PREVIEW_PROFILE.profileImage,
        toSpotifyUserId: body.toSpotifyUserId,
        status: "pending",
        createdAt: Date.now(),
      } satisfies ChatRequest,
    });
  }
  if (p === "/chat-requests/incoming")
    return json({
      requests: chatRequests.filter((r) => r.status === "pending"),
    });
  const respond = p.match(/^\/chat-requests\/([^/]+)\/(accept|decline)$/);
  if (respond && method === "POST") {
    const req = chatRequests.find(
      (r) => r.id === decodeURIComponent(respond[1]),
    );
    if (!req) return json({ error: "Request not found" }, 404);
    req.status = respond[2] === "accept" ? "accepted" : "declined";
    return json({ request: req });
  }

  return json(
    {
      error: `"${method} ${p}" isn't mocked in preview mode (add it to lib/previewData.ts)`,
    },
    404,
  );
}
