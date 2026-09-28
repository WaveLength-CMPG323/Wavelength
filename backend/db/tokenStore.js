// Stores Spotify tokens per user.
//
// If DATABASE_URL is set, this uses your Postgres instance (see the
// CREATE TABLE statement in README.md - run it once before using this).
//
// If DATABASE_URL is NOT set, it falls back to an in-memory Map so you
// can build/test the OAuth flow locally before Postgres is wired up.
// The in-memory store resets every time the server restarts and only
// works for a single userId ('demo-user') - it's a placeholder, not
// something to ship.

const useMemoryStore = !process.env.DATABASE_URL;

let pool;
if (!useMemoryStore) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

const memoryStore = new Map();

async function saveTokens(userId, tokenData) {
  const { accessToken, refreshToken, expiresAt, spotifyUserId, displayName, profileUrl, email, profileImage } =
    tokenData;

  if (useMemoryStore) {
    // A refresh-only save doesn't include the profile fields - merge so
    // those aren't wiped out by an ordinary token refresh.
    const existing = memoryStore.get(userId) || {};
    memoryStore.set(userId, {
      accessToken,
      refreshToken,
      expiresAt,
      spotifyUserId: spotifyUserId !== undefined ? spotifyUserId : existing.spotifyUserId,
      displayName: displayName !== undefined ? displayName : existing.displayName,
      profileUrl: profileUrl !== undefined ? profileUrl : existing.profileUrl,
      email: email !== undefined ? email : existing.email,
      profileImage: profileImage !== undefined ? profileImage : existing.profileImage,
    });
    return;
  }

  await pool.query(
    `INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at, spotify_user_id, display_name, profile_url, email, profile_image)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = $2, refresh_token = $3, expires_at = $4,
       spotify_user_id = COALESCE($5, spotify_tokens.spotify_user_id),
       display_name = COALESCE($6, spotify_tokens.display_name),
       profile_url = COALESCE($7, spotify_tokens.profile_url),
       email = COALESCE($8, spotify_tokens.email),
       profile_image = COALESCE($9, spotify_tokens.profile_image)`,
    [
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      spotifyUserId ?? null,
      displayName ?? null,
      profileUrl ?? null,
      email ?? null,
      profileImage ?? null,
    ]
  );
}

async function getTokens(userId) {
  if (useMemoryStore) {
    return memoryStore.get(userId) || null;
  }

  const result = await pool.query(
    `SELECT access_token AS "accessToken",
            refresh_token AS "refreshToken",
            expires_at AS "expiresAt",
            spotify_user_id AS "spotifyUserId",
            display_name AS "displayName",
            profile_url AS "profileUrl",
            email AS "email",
            profile_image AS "profileImage"
     FROM spotify_tokens
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Used by the background poller to know which sessions to check.
async function getAllUserIds() {
  if (useMemoryStore) {
    return Array.from(memoryStore.keys());
  }

  const result = await pool.query(`SELECT user_id FROM spotify_tokens`);
  return result.rows.map((r) => r.user_id);
}

// Looks up someone's stored profile info by their real Spotify account id,
// rather than by session id - used for a host's read-only Wavelength
// profile page. This is OUR OWN data (captured when that person logged
// into Wavelength themselves), not a live Spotify API call: as of
// Spotify's February 2026 changes, there is no more "get another user's
// profile" endpoint at all (GET /users/{id} was removed outright), so this
// is now the only way to show a host's name/avatar to someone else.
// If they've logged in more than once (e.g. two browser sessions), this
// just returns whichever entry the search happens to land on first -
// fine, since the profile fields should be identical across sessions for
// the same account.
async function getTokensBySpotifyUserId(spotifyUserId) {
  if (useMemoryStore) {
    for (const entry of memoryStore.values()) {
      if (entry.spotifyUserId === spotifyUserId) return entry;
    }
    return null;
  }

  const result = await pool.query(
    `SELECT spotify_user_id AS "spotifyUserId",
            display_name AS "displayName",
            profile_url AS "profileUrl",
            profile_image AS "profileImage"
     FROM spotify_tokens
     WHERE spotify_user_id = $1
     LIMIT 1`,
    [spotifyUserId]
  );
  return result.rows[0] || null;
}

module.exports = { saveTokens, getTokens, getTokensBySpotifyUserId, getAllUserIds, useMemoryStore };
