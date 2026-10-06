// Persistence for weekly challenges: who completed which week's challenge
// (which is also how rewards are "owned" - a reward is simply a completed
// challenge's cosmetic), and which cosmetic each person currently has on.
//
// Everything is keyed by the REAL Spotify account id (spotifyUserId), not
// the session id - sessions are throwaway per browser, but a reward is
// permanent and must survive logging out, a new browser, or a new device.
//
// Same pattern as tokenStore.js: Postgres when DATABASE_URL is set,
// otherwise an in-memory fallback so you can develop without a database.
// IMPORTANT: the in-memory fallback is wiped on every restart. Rewards are
// only truly permanent once DATABASE_URL points at a real Postgres.

const { useMemoryStore, pool } = require('./tokenStore');

// ---------- in-memory fallback ----------
const memCompletions = new Map(); // `${spotifyUserId}|${weekKey}` -> completion
const memActive = new Map(); // spotifyUserId -> cosmeticId

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS challenge_completions (
  spotify_user_id TEXT NOT NULL,
  week_key        TEXT NOT NULL,
  challenge_id    TEXT NOT NULL,
  theme           TEXT NOT NULL,
  cosmetic_id     TEXT NOT NULL,
  track_id        TEXT NOT NULL,
  track_name      TEXT,
  artist          TEXT,
  album_art       TEXT,
  completed_at    BIGINT NOT NULL,
  PRIMARY KEY (spotify_user_id, week_key)
);
CREATE INDEX IF NOT EXISTS challenge_completions_week_idx ON challenge_completions (week_key);

CREATE TABLE IF NOT EXISTS profile_cosmetics (
  spotify_user_id    TEXT PRIMARY KEY,
  active_cosmetic_id TEXT
);
`;

// Creates the tables if they don't exist yet. Safe to call on every boot.
async function ensureSchema() {
  if (useMemoryStore) return;
  await pool.query(SCHEMA_SQL);
}

function rowToCompletion(r) {
  return {
    spotifyUserId: r.spotify_user_id,
    weekKey: r.week_key,
    challengeId: r.challenge_id,
    theme: r.theme,
    cosmeticId: r.cosmetic_id,
    track: { id: r.track_id, name: r.track_name, artist: r.artist, albumArt: r.album_art },
    completedAt: Number(r.completed_at), // BIGINT comes back from pg as a string
  };
}

async function getCompletion(spotifyUserId, weekKey) {
  if (useMemoryStore) return memCompletions.get(`${spotifyUserId}|${weekKey}`) || null;

  const { rows } = await pool.query(
    `SELECT * FROM challenge_completions WHERE spotify_user_id = $1 AND week_key = $2`,
    [spotifyUserId, weekKey]
  );
  return rows[0] ? rowToCompletion(rows[0]) : null;
}

// Records "this person completed this week's challenge". Atomic: the
// (user, week) primary key means that even if someone double-clicks Submit
// or fires two requests at once, exactly one wins.
// Returns { created: true, completion } for the winner, or
// { created: false, completion } (the existing one) for the loser.
async function recordCompletion({ spotifyUserId, weekKey, challengeId, theme, cosmeticId, track, completedAt }) {
  if (useMemoryStore) {
    const key = `${spotifyUserId}|${weekKey}`;
    const existing = memCompletions.get(key);
    if (existing) return { created: false, completion: existing };
    const completion = { spotifyUserId, weekKey, challengeId, theme, cosmeticId, track, completedAt };
    memCompletions.set(key, completion);
    return { created: true, completion };
  }

  const { rows } = await pool.query(
    `INSERT INTO challenge_completions
       (spotify_user_id, week_key, challenge_id, theme, cosmetic_id, track_id, track_name, artist, album_art, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (spotify_user_id, week_key) DO NOTHING
     RETURNING *`,
    [
      spotifyUserId,
      weekKey,
      challengeId,
      theme,
      cosmeticId,
      track.id,
      track.name ?? null,
      track.artist ?? null,
      track.albumArt ?? null,
      completedAt,
    ]
  );
  if (rows[0]) return { created: true, completion: rowToCompletion(rows[0]) };

  return { created: false, completion: await getCompletion(spotifyUserId, weekKey) };
}

// Every challenge this person has ever completed, newest first.
async function getCompletions(spotifyUserId) {
  if (useMemoryStore) {
    return Array.from(memCompletions.values())
      .filter((c) => c.spotifyUserId === spotifyUserId)
      .sort((a, b) => b.completedAt - a.completedAt);
  }

  const { rows } = await pool.query(
    `SELECT * FROM challenge_completions WHERE spotify_user_id = $1 ORDER BY completed_at DESC`,
    [spotifyUserId]
  );
  return rows.map(rowToCompletion);
}

// How many people have completed a given week's challenge - a plain
// community total, not a ranking.
async function countCompletionsForWeek(weekKey) {
  if (useMemoryStore) {
    let n = 0;
    for (const c of memCompletions.values()) if (c.weekKey === weekKey) n++;
    return n;
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM challenge_completions WHERE week_key = $1`,
    [weekKey]
  );
  return rows[0].n;
}

async function getActiveCosmeticId(spotifyUserId) {
  if (useMemoryStore) return memActive.get(spotifyUserId) ?? null;

  const { rows } = await pool.query(
    `SELECT active_cosmetic_id FROM profile_cosmetics WHERE spotify_user_id = $1`,
    [spotifyUserId]
  );
  return rows[0]?.active_cosmetic_id ?? null;
}

// cosmeticId = null turns the cosmetic off. (Ownership is checked by the
// caller - this layer just stores the choice.)
async function setActiveCosmeticId(spotifyUserId, cosmeticId) {
  if (useMemoryStore) {
    if (cosmeticId) memActive.set(spotifyUserId, cosmeticId);
    else memActive.delete(spotifyUserId);
    return;
  }

  await pool.query(
    `INSERT INTO profile_cosmetics (spotify_user_id, active_cosmetic_id)
     VALUES ($1, $2)
     ON CONFLICT (spotify_user_id) DO UPDATE SET active_cosmetic_id = $2`,
    [spotifyUserId, cosmeticId]
  );
}

module.exports = {
  ensureSchema,
  getCompletion,
  recordCompletion,
  getCompletions,
  countCompletionsForWeek,
  getActiveCosmeticId,
  setActiveCosmeticId,
};
