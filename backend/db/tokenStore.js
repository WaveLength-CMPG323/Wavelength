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

// Shared across every Postgres-backed module in this backend (see
// db/pool.js) instead of each one opening its own `new Pool(...)` - keeps
// the total number of connections to the hosted Postgres instance (which
// providers like Supabase cap) to one pool for the whole process. It's
// `null` in memory-store mode, which is fine: every usage below is already
// gated behind `useMemoryStore`.
const pool = require('./pool');

const memoryStore = new Map();

// A separate "last known" profile cache, keyed by real Spotify account id
// rather than by session - mirrors the known_profiles Postgres table (see
// db/schema-additions.sql) for memory-store/local-dev mode. Unlike
// memoryStore/spotify_tokens, nothing ever deletes from this: it's updated
// on every login, but a logout only removes the session's live token entry,
// not this cache - see deleteTokens and getTokensBySpotifyUserId below.
const knownProfiles = new Map();

async function upsertKnownProfile({ spotifyUserId, displayName, profileUrl, profileImage }) {
  if (!spotifyUserId) return;

  if (useMemoryStore) {
    const existing = knownProfiles.get(spotifyUserId) || {};
    knownProfiles.set(spotifyUserId, {
      spotifyUserId,
      displayName: displayName !== undefined ? displayName : existing.displayName,
      profileUrl: profileUrl !== undefined ? profileUrl : existing.profileUrl,
      profileImage: profileImage !== undefined ? profileImage : existing.profileImage,
      nickname: existing.nickname ?? null,
      bio: existing.bio ?? null,
    });
    return;
  }

  await pool.query(
    `INSERT INTO known_profiles (spotify_user_id, display_name, profile_url, profile_image, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (spotify_user_id) DO UPDATE SET
       display_name = COALESCE($2, known_profiles.display_name),
       profile_url = COALESCE($3, known_profiles.profile_url),
       profile_image = COALESCE($4, known_profiles.profile_image),
       updated_at = now()`,
    [spotifyUserId, displayName ?? null, profileUrl ?? null, profileImage ?? null]
  );
}

// Saves a person's own nickname/bio, set from their profile page - unlike
// upsertKnownProfile above (which runs automatically on every login/token
// refresh with Spotify-sourced fields), this is only ever called when the
// person themselves explicitly saves these two fields. Uses the same
// known_profiles cache since it already survives logout, but inserts a
// bare row (no display name/avatar yet) if someone somehow saves this
// before any login has created one - shouldn't normally happen, since
// logging in is required to reach the profile page at all.
async function saveProfileDetails(spotifyUserId, { nickname, bio }) {
  if (!spotifyUserId) return;

  if (useMemoryStore) {
    const existing = knownProfiles.get(spotifyUserId) || { spotifyUserId };
    knownProfiles.set(spotifyUserId, {
      ...existing,
      spotifyUserId,
      nickname: nickname !== undefined ? nickname : existing.nickname ?? null,
      bio: bio !== undefined ? bio : existing.bio ?? null,
    });
    return;
  }

  await pool.query(
    `INSERT INTO known_profiles (spotify_user_id, nickname, bio, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (spotify_user_id) DO UPDATE SET
       nickname = $2,
       bio = $3,
       updated_at = now()`,
    [spotifyUserId, nickname ?? null, bio ?? null]
  );
}

async function saveTokens(userId, tokenData) {
  const { accessToken, refreshToken, expiresAt, spotifyUserId, displayName, profileUrl, email, profileImage } =
    tokenData;

  // Keep the permanent name/avatar cache current too, independent of the
  // live session token - see knownProfiles/known_profiles above. Best
  // effort: never let this block or fail an actual login/refresh.
  upsertKnownProfile({ spotifyUserId, displayName, profileUrl, profileImage }).catch((err) => {
    console.error('Could not update known_profiles cache:', err.message);
  });

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
    const stored = memoryStore.get(userId);
    if (!stored) return null;
    const known = stored.spotifyUserId ? knownProfiles.get(stored.spotifyUserId) : null;
    return { ...stored, nickname: known?.nickname ?? null, bio: known?.bio ?? null };
  }

  // LEFT JOINed against known_profiles for nickname/bio, since those two
  // fields only ever live there (see saveProfileDetails above), never on
  // spotify_tokens itself.
  const result = await pool.query(
    `SELECT t.access_token AS "accessToken",
            t.refresh_token AS "refreshToken",
            t.expires_at AS "expiresAt",
            t.spotify_user_id AS "spotifyUserId",
            t.display_name AS "displayName",
            t.profile_url AS "profileUrl",
            t.email AS "email",
            t.profile_image AS "profileImage",
            k.nickname AS "nickname",
            k.bio AS "bio"
     FROM spotify_tokens t
     LEFT JOIN known_profiles k ON k.spotify_user_id = t.spotify_user_id
     WHERE t.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// Called on logout. Without this, a logged-out browser's tokens (and
// hence its Spotify account) would stay in the store forever - orphaned,
// per the old comment in routes/auth.js - and getAllUserIds() below would
// keep handing it to the poller indefinitely. That mattered for more than
// just tidiness: if the best-effort pause-on-logout call failed (no
// active device, free/non-Premium account), the account would keep
// actually playing on Spotify, and the very next poll cycle would
// re-report it and resurrect the "logged out but still showing" bubble
// that oceanState.removeSession() just cleared. Deleting the tokens here
// stops that account from ever being polled again after logout.
async function deleteTokens(userId) {
  if (!userId) return;

  if (useMemoryStore) {
    memoryStore.delete(userId);
    return;
  }

  await pool.query(`DELETE FROM spotify_tokens WHERE user_id = $1`, [userId]);
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
    const known = knownProfiles.get(spotifyUserId);
    for (const entry of memoryStore.values()) {
      if (entry.spotifyUserId === spotifyUserId) {
        return { ...entry, nickname: known?.nickname ?? null, bio: known?.bio ?? null };
      }
    }
    // Not currently logged in anywhere (or just logged out) - fall back to
    // the permanent name/avatar cache so they still show up as themselves,
    // not their raw account id, to friends/requests.
    return known || null;
  }

  // LEFT JOINed against known_profiles for nickname/bio - see getTokens.
  const result = await pool.query(
    `SELECT t.spotify_user_id AS "spotifyUserId",
            t.display_name AS "displayName",
            t.profile_url AS "profileUrl",
            t.profile_image AS "profileImage",
            k.nickname AS "nickname",
            k.bio AS "bio"
     FROM spotify_tokens t
     LEFT JOIN known_profiles k ON k.spotify_user_id = t.spotify_user_id
     WHERE t.spotify_user_id = $1
     LIMIT 1`,
    [spotifyUserId]
  );
  if (result.rows[0]) return result.rows[0];

  // Same fallback as above, for someone who has since logged out - their
  // spotify_tokens row is gone (deleteTokens deletes it outright so the
  // poller stops retrying a dead session), but known_profiles never gets
  // cleared, so their last known name/avatar (and nickname/bio) is still here.
  const cached = await pool.query(
    `SELECT spotify_user_id AS "spotifyUserId",
            display_name AS "displayName",
            profile_url AS "profileUrl",
            profile_image AS "profileImage",
            nickname AS "nickname",
            bio AS "bio"
     FROM known_profiles
     WHERE spotify_user_id = $1
     LIMIT 1`,
    [spotifyUserId]
  );
  return cached.rows[0] || null;
}

module.exports = {
  saveTokens,
  getTokens,
  deleteTokens,
  getTokensBySpotifyUserId,
  getAllUserIds,
  saveProfileDetails,
  useMemoryStore,
};
