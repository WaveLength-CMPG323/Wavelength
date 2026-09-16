// Direct TypeScript port of the team's original app.js data layer.
// Swap this module out for real fetch()/Socket.IO calls to the Node/Express
// backend later -- every component should only ever import from here (or
// DataContext), never touch localStorage directly, so that swap stays
// contained to this one file.

import type { AppState, CatalogEntry } from './types';

const KEY = 'wavelength_db_v2';

const CHALLENGE_THEMES = [
  'NOSTALGIA', '80S', 'RAINY DAY', 'MIDNIGHT DRIVE', 'FIRST LOVE', 'SUMMER HEAT', 'HOMECOMING',
];

// Stand-in for a real Spotify catalog search until the backend Web API
// integration exists.
const SPOTIFY_CATALOG: CatalogEntry[] = [
  { title: 'Take On Me', artist: 'a-ha' },
  { title: 'Yesterday Once More', artist: 'The Carpenters' },
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Nights', artist: 'Frank Ocean' },
  { title: 'Landslide', artist: 'Fleetwood Mac' },
  { title: 'Electric Feel', artist: 'MGMT' },
  { title: 'Sunflower', artist: 'Rex Orange County' },
  { title: 'Redbone', artist: 'Childish Gambino' },
  { title: 'Dreams', artist: 'Fleetwood Mac' },
  { title: 'Midnight City', artist: 'M83' },
  { title: 'Circles', artist: 'Post Malone' },
  { title: 'Ribs', artist: 'Lorde' },
  { title: 'Home', artist: 'Edward Sharpe & The Magnetic Zeros' },
  { title: 'Two Slow Dancers', artist: 'Mitski' },
  { title: 'Blue', artist: 'Yung Kai' },
  { title: 'Missing You', artist: 'John Waite' },
  { title: 'Sweater Weather', artist: 'The Neighbourhood' },
  { title: 'Golden', artist: 'Harry Styles' },
];

function seed(): AppState {
  return {
    me: {
      id: 'me',
      name: 'You',
      pic: '/avatars/avatar4.svg',
      genres: [],
      nickname: '',
      bio: '',
      spotifyUsername: 'you.on.spotify',
      spotifyPic: '/avatars/avatar4.svg',
    },
    users: {
      u1: { id: 'u1', name: 'Jake Doe', pic: '/avatars/avatar1.svg', followers: 1280, following: 54, listening: 's3', followedByMe: false, chatStatus: 'friend' },
      u2: { id: 'u2', name: 'Mia Chen', pic: '/avatars/avatar2.svg', followers: 542, following: 210, listening: 's1', followedByMe: false, chatStatus: 'none' },
      u3: { id: 'u3', name: 'Theo Park', pic: '/avatars/avatar3.svg', followers: 89, following: 130, listening: null, followedByMe: true, chatStatus: 'friend' },
    },
    songs: {
      s1: { id: 's1', title: 'Blooming of Me', artist: 'Artist Name', cover: '/covers/cover1.svg', ownerId: 'u1' },
      s2: { id: 's2', title: 'Flower', artist: 'Artist Name', cover: '/covers/cover2.svg', ownerId: 'u2' },
      s3: { id: 's3', title: 'Peace of Mind', artist: 'Jake Doe', cover: '/covers/cover3.svg', ownerId: 'u1' },
    },
    floaterOrder: ['s1', 's2', 's3'],
    chats: {
      u1: [
        { from: 'u1', text: 'hey! did you catch my new upload?', ts: Date.now() - 1000 * 60 * 60 },
        { from: 'me', text: "listening now, it's great", ts: Date.now() - 1000 * 60 * 55 },
      ],
      u3: [
        { from: 'u3', text: 'joining the lo-fi group tonight?', ts: Date.now() - 1000 * 60 * 30 },
      ],
    },
    groups: {
      g1: { id: 'g1', name: 'Late Night Lo-fi', icon: '/avatars/avatar5.svg', members: ['me', 'u1', 'u3'] },
    },
    notifications: [
      { id: 'n1', userId: 'u2', status: 'pending' },
      { id: 'n2', userId: 'u3', status: 'pending' },
    ],
    hasNotifDot: true,
    hasChatDot: true,
    challenge: {
      theme: 'NOSTALGIA',
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
      mySubmission: null,
    },
  };
}

// Placeholder artwork pool. Swap these files in public/covers/ for real
// album art (or replace this with Spotify's image URLs once the API is wired).
export const PLACEHOLDER_COVERS = [
  '/covers/cover1.svg', '/covers/cover2.svg', '/covers/cover3.svg',
  '/covers/cover4.svg', '/covers/cover5.svg', '/covers/cover6.svg',
];

export function randomCover(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PLACEHOLDER_COVERS[Math.abs(hash) % PLACEHOLDER_COVERS.length];
}

export function searchSpotifyCatalog(query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return SPOTIFY_CATALOG.filter(
    (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  ).slice(0, 6);
}

export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

// If the current weekly challenge's 7-day window has closed, roll over to a
// fresh theme + deadline and clear the submission flag ("once per week").
export function rolloverChallengeIfNeeded(db: AppState): AppState {
  if (Date.now() >= db.challenge.deadline) {
    const nextTheme = CHALLENGE_THEMES[Math.floor(Math.random() * CHALLENGE_THEMES.length)];
    db.challenge = { theme: nextTheme, deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, mySubmission: null };
    save(db);
  }
  return db;
}

export function load(): AppState {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const fresh = seed();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const db = JSON.parse(raw) as AppState;
    return db;
  } catch {
    const fresh = seed();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
}

export function save(db: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function reset(): AppState {
  localStorage.removeItem(KEY);
  return load();
}

/* ---------- shared formatting helpers (ported from app.js) ---------- */

export function formatCountdown(msRemaining: number): string {
  if (msRemaining < 0) msRemaining = 0;
  const totalSeconds = Math.floor(msRemaining / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

// Cosmetic "tier" flourish for the profile header -- purely derived, not
// stored, so it never needs its own field in the data model.
export function tierLabel(genreCount: number): string {
  if (genreCount >= 6) return 'Abyss Explorer';
  if (genreCount >= 3) return 'Deep Diver';
  if (genreCount >= 1) return 'Tide Rider';
  return 'New Wave';
}

// Same cosmetic tier idea, but for other users where we only have a
// followers count to go on (they don't expose their genre list to us).
export function tierFromFollowers(followers: number): string {
  if (followers >= 1000) return 'Abyss Explorer';
  if (followers >= 300) return 'Deep Diver';
  if (followers >= 50) return 'Tide Rider';
  return 'New Wave';
}

export function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
