// Private chat requests and accepted conversations are stored by Spotify account ID.

const { useMemoryStore } = require('../db/tokenStore');
const pool = require('../db/pool');
const chatHistory = require('../db/chatHistory');
const requests = new Map(); // id -> request
let nextId = 1;

function fromRow(row, profile = {}) {
  return {
    id: String(row.id),
    fromSpotifyUserId: row.from_spotify_user_id,
    fromDisplayName: profile.displayName ?? null,
    fromProfileImage: profile.profileImage ?? null,
    toSpotifyUserId: row.to_spotify_user_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Creates a new pending request, unless an identical one (same two
// people, still pending) already exists - returns that instead of
// spamming duplicates if someone double-clicks "Request Chat".
async function createRequest({ fromSpotifyUserId, fromDisplayName, fromProfileImage, toSpotifyUserId }) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `INSERT INTO chat_requests (from_spotify_user_id, to_spotify_user_id)
       VALUES ($1, $2)
       ON CONFLICT (from_spotify_user_id, to_spotify_user_id) WHERE status = 'pending'
       DO UPDATE SET from_spotify_user_id = EXCLUDED.from_spotify_user_id
       RETURNING *`,
      [fromSpotifyUserId, toSpotifyUserId]
    );
    return fromRow(result.rows[0], { displayName: fromDisplayName, profileImage: fromProfileImage });
  }

  for (const r of requests.values()) {
    if (r.fromSpotifyUserId === fromSpotifyUserId && r.toSpotifyUserId === toSpotifyUserId && r.status === 'pending') {
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
// tab should show.
async function getIncoming(spotifyUserId) {
  if (!useMemoryStore) {
    const result = await pool.query(
      `SELECT * FROM chat_requests
       WHERE to_spotify_user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC, id DESC`,
      [spotifyUserId]
    );
    return result.rows.map((row) => fromRow(row));
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

// IMPORTANT: this is not a chat record and it is not the final database model.
// It is only a temporary permission check for the live private chat room.
//
// TEMPORARY RULE:
// If an accepted request exists between these two users in either direction,
// allow the private Socket.IOroom to open.
//
// This is a permission gate for live chat access, not a conversation history.
//
// FUTURE DATABASE VERSION:
// When chat persistence is added, the real source of truth may become:
// - a persisted conversation record, or
// - a persisted acceptance record linked to a conversation table
//
// For now, the request status is being used as the gate because the app has
// no database-backed messages or chat rooms yet.
async function hasAcceptedPrivateChatRequest(userA, userB) {
  if (!useMemoryStore) {
    const conversationId = await chatHistory.findPrivateConversation(userA, userB);
    return Boolean(conversationId);
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

module.exports = {
  createRequest,
  getIncoming,
  getAccepted,
  respond,
  hasAcceptedPrivateChatRequest,
};