// Chat REQUESTS only - not chat itself. Tracks "person A wants to start a
// chat with person B" so it can show up in B's Notifications and be
// accepted/declined. Also doubles as the access gate for the live private
// chat room (hasAcceptedPrivateChatRequest below) and the "friends list"
// for the Chat page (getAccepted).
//
// Keyed by real Spotify account id (spotifyUserId), not session id -
// unlike oceanState (which is deliberately ephemeral per-session), a
// pending request needs to survive the recipient logging out and back in,
// or checking from a different browser/device, since "chat account" here
// just means "whichever real Spotify account this is."
//
// If DATABASE_URL is set, this is backed by the live Supabase `chat_requests`
// table (see backend/db/schema-additions.sql for the one additive migration
// createRequest()'s upsert relies on). If not, it falls back to the
// original in-memory Map so local dev without Postgres keeps working
// exactly as it did before persistence was added.

const { useMemoryStore, getTokensBySpotifyUserId } = require('../db/tokenStore');
const pool = require('../db/pool');
const chatHistory = require('../db/chatHistory');

const requests = new Map(); // id -> request (memory-store only)
let nextId = 1;

function fromRow(row, profile = {}) {
  return {
    id: String(row.id),
    fromSpotifyUserId: row.from_spotify_user_id,
    fromDisplayName: profile.nickname || profile.displayName || null,
    fromProfileImage: profile.profileImage ?? null,
    toSpotifyUserId: row.to_spotify_user_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Creates a new pending request, unless an identical one (same two
// people, still pending) already exists - returns that instead of
// spamming duplicates if someone double-clicks "Request Chat".
//
// Mutual intent: if the target already has a pending request out to the
// sender (they both clicked "Request Chat" on each other, most likely
// because neither realized Accept lives in Notifications), treat this as
// an immediate accept of that existing reverse request rather than
// creating a second pending request that would just sit there forever.
async function createRequest({ fromSpotifyUserId, fromDisplayName, fromProfileImage, toSpotifyUserId }) {
  if (!useMemoryStore) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reverse-direction pending request (target -> sender)? Flip it to
      // accepted instead of creating a new forward request.
      const reverse = await client.query(
        `SELECT * FROM chat_requests
         WHERE from_spotify_user_id = $1 AND to_spotify_user_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [toSpotifyUserId, fromSpotifyUserId]
      );
      if (reverse.rows[0]) {
        const updated = await client.query(
          `UPDATE chat_requests SET status = 'accepted', responded_at = now()
           WHERE id = $1
           RETURNING *`,
          [reverse.rows[0].id]
        );
        const request = updated.rows[0];
        await chatHistory.ensurePrivateConversation(
          request.from_spotify_user_id,
          request.to_spotify_user_id,
          client
        );
        await client.query('COMMIT');
        const reverseSenderProfile = await getTokensBySpotifyUserId(request.from_spotify_user_id);
        return fromRow(request, {
          displayName: reverseSenderProfile?.displayName ?? null,
          nickname: reverseSenderProfile?.nickname ?? null,
          profileImage: reverseSenderProfile?.profileImage ?? null,
        });
      }

      // No reverse request - create/reuse the forward pending request.
      // Relies on the partial unique index added by
      // db/schema-additions.sql (chat_requests_one_pending_pair).
      const result = await client.query(
        `INSERT INTO chat_requests (from_spotify_user_id, to_spotify_user_id)
         VALUES ($1, $2)
         ON CONFLICT (from_spotify_user_id, to_spotify_user_id) WHERE status = 'pending'
         DO UPDATE SET from_spotify_user_id = EXCLUDED.from_spotify_user_id
         RETURNING *`,
        [fromSpotifyUserId, toSpotifyUserId]
      );
      await client.query('COMMIT');
      return fromRow(result.rows[0], { displayName: fromDisplayName, profileImage: fromProfileImage });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  for (const r of requests.values()) {
    if (r.fromSpotifyUserId === fromSpotifyUserId && r.toSpotifyUserId === toSpotifyUserId && r.status === 'pending') {
      return r;
    }
  }

  for (const r of requests.values()) {
    if (r.fromSpotifyUserId === toSpotifyUserId && r.toSpotifyUserId === fromSpotifyUserId && r.status === 'pending') {
      r.status = 'accepted';
      await chatHistory.ensurePrivateConversation(r.fromSpotifyUserId, r.toSpotifyUserId);
      return r;
    }
  }

  const id = String(nextId++);
  const request = {
    id,
    fromSpotifyUserId,
    fromDisplayName,
    fromProfileImage,
    toSpotifyUserId,
    status: 'pending', // 'pending' | 'accepted' | 'declined'
    createdAt: Date.now(),
  };
  requests.set(id, request);
  return request;
}

// Pending requests addressed TO this person - what their Notifications
// tab should show. Enriches each row with the sender's current profile
// (display name/avatar) - without this, every incoming request would show
// up in Notifications with no name or picture at all.
async function getIncoming(spotifyUserId) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `SELECT * FROM chat_requests
       WHERE to_spotify_user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC, id DESC`,
      [spotifyUserId]
    );
    return Promise.all(
      result.rows.map(async (row) => {
        const profile = await getTokensBySpotifyUserId(row.from_spotify_user_id);
        return fromRow(row, {
          displayName: profile?.nickname || profile?.displayName || row.from_spotify_user_id,
          profileImage: profile?.profileImage ?? null,
        });
      })
    );
  }

  return Array.from(requests.values())
    .filter((r) => r.toSpotifyUserId === spotifyUserId && r.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Accepts or declines a request - only the recipient can respond to it.
// Returns null if the request doesn't exist, isn't theirs, or was already
// responded to (so a double-click can't flip an already-accepted request).
async function respond(id, spotifyUserId, accept) {
  if (!useMemoryStore) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE chat_requests
         SET status = $3, responded_at = now()
         WHERE id = $1 AND to_spotify_user_id = $2 AND status = 'pending'
         RETURNING *`,
        [id, spotifyUserId, accept ? 'accepted' : 'declined']
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      const request = result.rows[0];
      if (accept) {
        await chatHistory.ensurePrivateConversation(
          request.from_spotify_user_id,
          request.to_spotify_user_id,
          client
        );
      }
      await client.query('COMMIT');
      return fromRow(request);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const r = requests.get(id);
  if (!r || r.toSpotifyUserId !== spotifyUserId || r.status !== 'pending') return null;
  r.status = accept ? 'accepted' : 'declined';
  if (accept) await chatHistory.ensurePrivateConversation(r.fromSpotifyUserId, r.toSpotifyUserId);
  return r;
}

// IMPORTANT: this is not a chat record and it is not the final database
// model. It is only a permission check for the live private chat room.
//
// This is gated purely on chat_requests.status = 'accepted', NOT on
// whether a private_conversations row exists - that row is permanent once
// created (needed for message history) and never gets "closed" again, so
// checking its existence would mean an unfriend-then-re-request pair could
// never be gated again, bypassing the whole request/accept flow. revoke()
// below flips the request back to 'declined', which this correctly reads
// as "no longer accepted" without touching the conversation/history row.
async function hasAcceptedPrivateChatRequest(userA, userB) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `SELECT 1 FROM chat_requests
       WHERE status = 'accepted'
         AND ((from_spotify_user_id = $1 AND to_spotify_user_id = $2)
           OR (from_spotify_user_id = $2 AND to_spotify_user_id = $1))
       LIMIT 1`,
      [userA, userB]
    );
    return result.rows.length > 0;
  }

  for (const request of requests.values()) {
    const aToB = request.fromSpotifyUserId === userA && request.toSpotifyUserId === userB;
    const bToA = request.fromSpotifyUserId === userB && request.toSpotifyUserId === userA;

    if ((aToB || bToA) && request.status === 'accepted') {
      return true;
    }
  }

  return false;
}

// Accepted requests involving this person, deduped by the other party - the
// "friends list" for the real chat feature.
async function getAccepted(spotifyUserId) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `SELECT * FROM chat_requests
       WHERE status = 'accepted'
         AND (from_spotify_user_id = $1 OR to_spotify_user_id = $1)
       ORDER BY responded_at DESC NULLS LAST, id DESC`,
      [spotifyUserId]
    );
    const chatsByPartner = new Map();
    for (const row of result.rows) {
      const partnerId = row.from_spotify_user_id === spotifyUserId
        ? row.to_spotify_user_id
        : row.from_spotify_user_id;
      if (!chatsByPartner.has(partnerId)) chatsByPartner.set(partnerId, fromRow(row));
    }
    return Array.from(chatsByPartner.values());
  }

  const acceptedByOtherUser = new Map();

  for (const request of requests.values()) {
    if (request.status !== 'accepted') continue;

    const involvesUser =
      request.fromSpotifyUserId === spotifyUserId ||
      request.toSpotifyUserId === spotifyUserId;

    if (!involvesUser) continue;

    const otherUserId =
      request.fromSpotifyUserId === spotifyUserId
        ? request.toSpotifyUserId
        : request.fromSpotifyUserId;

    acceptedByOtherUser.set(otherUserId, request);
  }

  return Array.from(acceptedByOtherUser.values());
}

// Revokes an already-accepted request (either party can do this - "unfriending"
// someone should work the same from either side). Sets it back to 'declined' so
// hasAcceptedPrivateChatRequest() correctly stops allowing the private chat room.
async function revoke(id, spotifyUserId) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `UPDATE chat_requests
       SET status = 'declined', responded_at = now()
       WHERE id = $1 AND status = 'accepted' AND (from_spotify_user_id = $2 OR to_spotify_user_id = $2)
       RETURNING *`,
      [id, spotifyUserId]
    );
    if (!result.rows[0]) return null;
    return fromRow(result.rows[0]);
  }

  const r = requests.get(id);
  if (!r || r.status !== 'accepted') return null;
  if (r.fromSpotifyUserId !== spotifyUserId && r.toSpotifyUserId !== spotifyUserId) return null;
  r.status = 'declined';
  return r;
}

module.exports = {
  createRequest,
  getIncoming,
  respond,
  hasAcceptedPrivateChatRequest,
  getAccepted,
  revoke,
};
