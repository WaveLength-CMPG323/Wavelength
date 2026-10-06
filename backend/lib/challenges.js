// Weekly challenge catalog + "which challenge is live right now" logic.
//
// There is deliberately NO scheduler/cron here. The active challenge is a
// pure function of the calendar: every week (Monday 00:00 -> next Monday
// 00:00) maps to one entry in CHALLENGES, cycling forever. That means:
//   - a new challenge appears on its own every week, with nothing to run,
//     nothing to restart, and nothing that can silently stop working;
//   - every server instance / restart agrees on the current challenge;
//   - the frontend never needs to "roll over" anything itself.
//
// Each challenge awards its own cosmetic. The backend only knows cosmetic
// ids + display data (kind/colours); the frontend renders them (see
// frontend/src/components/CosmeticAvatar.tsx). To add content, just append
// to COSMETICS / CHALLENGES below - no other file needs to change.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Monday 1 Jan 2024 00:00 UTC. Any Monday works; this is just the anchor
// that weeks are counted from. Don't change it once real users have data,
// or the rotation order shifts.
const EPOCH_MONDAY_UTC = Date.UTC(2024, 0, 1);

// Weeks roll over at Monday 00:00 UTC by default. To roll over at Monday
// 00:00 in another timezone, set CHALLENGE_TZ_OFFSET_HOURS in .env
// (e.g. 2 for South Africa, SAST = UTC+2).
function tzOffsetMs() {
  const hours = Number(process.env.CHALLENGE_TZ_OFFSET_HOURS);
  return Number.isFinite(hours) ? hours * 60 * 60 * 1000 : 0;
}

// kind: how the frontend draws it
//   'frame'  - solid gradient ring around the avatar
//   'glow'   - ring + soft pulsing glow
//   'ripple' - ring + expanding ripples
// color/accent: the two colours it's drawn with
const COSMETICS = [
  { id: 'tide-ring',       name: 'Tide Ring',       kind: 'frame',  color: '#22d3ee', accent: '#0ea5e9', description: 'A clean ring of rolling tide.' },
  { id: 'coral-glow',      name: 'Coral Glow',      kind: 'glow',   color: '#fb7185', accent: '#f97316', description: 'A warm pulse, straight off the reef.' },
  { id: 'moonlit-ripple',  name: 'Moonlit Ripple',  kind: 'ripple', color: '#c4b5fd', accent: '#818cf8', description: 'Moonlight spreading across still water.' },
  { id: 'sunset-shimmer',  name: 'Sunset Shimmer',  kind: 'frame',  color: '#fbbf24', accent: '#f43f5e', description: 'The last light of the day on the waves.' },
  { id: 'kelp-forest',     name: 'Kelp Forest',     kind: 'glow',   color: '#34d399', accent: '#16a34a', description: 'A deep green glow from the kelp beds.' },
  { id: 'pearl-frame',     name: 'Pearl Frame',     kind: 'frame',  color: '#f1f5f9', accent: '#e9d5ff', description: 'A soft, polished pearl border.' },
  { id: 'deep-sea-pulse',  name: 'Deep Sea Pulse',  kind: 'ripple', color: '#38bdf8', accent: '#1d4ed8', description: 'Sonar pings from the deep.' },
  { id: 'aurora-halo',     name: 'Aurora Halo',     kind: 'glow',   color: '#a3e635', accent: '#22d3ee', description: 'Northern lights, over the ocean.' },
  { id: 'starfish-spark',  name: 'Starfish Spark',  kind: 'frame',  color: '#fcd34d', accent: '#fb923c', description: 'A golden frame with a spark of orange.' },
  { id: 'lagoon-ripple',   name: 'Lagoon Ripple',   kind: 'ripple', color: '#2dd4bf', accent: '#67e8f9', description: 'Warm, clear lagoon water.' },
  { id: 'midnight-glow',   name: 'Midnight Glow',   kind: 'glow',   color: '#6366f1', accent: '#a855f7', description: 'A violet glow for late-night listening.' },
  { id: 'sea-foam-crest',  name: 'Sea Foam Crest',  kind: 'frame',  color: '#86efac', accent: '#5eead4', description: 'The pale crest of a breaking wave.' },
];

// Order here = order they run in. Keep one cosmetic per challenge, and no
// cosmetic used twice, so every week in a cycle gives something new.
const CHALLENGES = [
  { id: 'childhood',    theme: 'Childhood Soundtrack', description: 'Share a song from your childhood.',                 cosmeticId: 'tide-ring' },
  { id: 'translation',  theme: 'Lost in Translation',  description: 'Share a song in a language you don’t speak.',  cosmeticId: 'coral-glow' },
  { id: 'hidden-gem',   theme: 'Hidden Gem',           description: 'Share an underrated artist you think deserves more ears.', cosmeticId: 'moonlit-ripple' },
  { id: 'silver-screen', theme: 'Silver Screen',       description: 'Share your favourite movie soundtrack track.',      cosmeticId: 'sunset-shimmer' },
  { id: 'mzansi',       theme: 'Mzansi Vibes',         description: 'Share a track from a South African artist.',        cosmeticId: 'kelp-forest' },
  { id: 'on-repeat',    theme: 'On Repeat',            description: 'Share the song you’ve had on repeat this week.', cosmeticId: 'pearl-frame' },
  { id: 'rainy-day',    theme: 'Rainy Day',            description: 'Share the perfect song for a rainy day.',           cosmeticId: 'deep-sea-pulse' },
  { id: 'midnight',     theme: 'Midnight Drive',       description: 'Share a song for driving at night.',                cosmeticId: 'aurora-halo' },
  { id: 'first-love',   theme: 'First Love',           description: 'Share a song that takes you back to your first love.', cosmeticId: 'starfish-spark' },
  { id: 'summer-heat',  theme: 'Summer Heat',          description: 'Share a song that sounds like summer.',             cosmeticId: 'lagoon-ripple' },
  { id: 'eighties',     theme: 'Throwback 80s',        description: 'Share your favourite song from the 80s.',           cosmeticId: 'midnight-glow' },
  { id: 'homecoming',   theme: 'Homecoming',           description: 'Share a song that feels like home.',                cosmeticId: 'sea-foam-crest' },
];

const cosmeticsById = new Map(COSMETICS.map((c) => [c.id, c]));

function getCosmeticById(id) {
  return cosmeticsById.get(id) || null;
}

// The shape sent to the client.
function publicCosmetic(c) {
  if (!c) return null;
  return { id: c.id, name: c.name, description: c.description, kind: c.kind, color: c.color, accent: c.accent };
}

// Which week is `now` in? Returns the window plus the challenge that runs
// in it. weekKey is the Monday's date (e.g. "2026-10-05"): human-readable
// in the database, and stable.
function getWeek(now = Date.now()) {
  const offset = tzOffsetMs();
  const weekIndex = Math.floor((now + offset - EPOCH_MONDAY_UTC) / WEEK_MS);
  const startsAt = EPOCH_MONDAY_UTC + weekIndex * WEEK_MS - offset;
  const endsAt = startsAt + WEEK_MS;
  const weekKey = new Date(startsAt + offset).toISOString().slice(0, 10);

  // ((n % m) + m) % m keeps the index valid even for dates before the anchor.
  const n = CHALLENGES.length;
  const def = CHALLENGES[((weekIndex % n) + n) % n];

  return {
    weekKey,
    startsAt,
    endsAt,
    challenge: {
      id: def.id,
      theme: def.theme,
      description: def.description,
      cosmetic: getCosmeticById(def.cosmeticId),
    },
  };
}

module.exports = { COSMETICS, CHALLENGES, WEEK_MS, getWeek, getCosmeticById, publicCosmetic };
