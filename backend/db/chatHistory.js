// Real message persistence for private 1:1 chat and group chat.
//
// If DATABASE_URL is set, this uses the live Supabase-hosted Postgres
// tables (private_conversations/private_messages/chat_groups/
// group_messages - see the CREATE TABLE statements the user already ran,
// and backend/db/schema-additions.sql for the one additive migration this
// module's upsert in ensurePrivateConversation() relies on).
//
// If DATABASE_URL is NOT set, this falls back to in-memory Maps so local
// dev without Postgres still works exactly as it did before persistence
// was added - lost on restart, same tradeoff as the rest of this project
// pre-database.
const { randomUUID } = require('node:crypto');
const { useMemoryStore } = require('./tokenStore');
const pool = require('./pool');

const HISTORY_LIMIT = 100;
const memoryConversations = new Map();
const memoryPrivateMessages = new Map();
const memoryGroupMessages = new Map();

function pairKey(userA, userB) {
  return [userA, userB].sort().join(':');
}

function toMessage(row, senderField = 'sender_spotify_user_id') {
  return {
    id: String(row.id),
    from: row[senderField],
    text: row.body,
    ts: new Date(row.created_at).getTime(),
  };
}

// Creates (or finds) the permanent conversation row for this pair of users,
// used as the foreign key for every private_messages row between them.
// Called from lib/chatRequests.js's respond() when a chat request is
// accepted - once created, this row is never deleted, even after an
// unfriend/revoke (see hasAcceptedPrivateChatRequest() in
// lib/chatRequests.js for why the *access gate* lives on chat_requests.status
// instead of on this row's existence).
async function ensurePrivateConversation(userA, userB, queryable = pool) {
  if (!userA || !userB || userA === userB) {
    throw new Error('Two different users are required for a private conversation');
  }

  const [firstUser, secondUser] = [userA, userB].sort();
  const key = pairKey(firstUser, secondUser);
  if (useMemoryStore) {
    if (!memoryConversations.has(key)) memoryConversations.set(key, randomUUID());
    return memoryConversations.get(key);
  }

  // Relies on the unique constraint added by db/schema-additions.sql
  // (private_conversations_pair_unique) - the live table as handed to us
  // doesn't have one on its own, only a primary key on `id`.
  const result = await queryable.query(
    `INSERT INTO private_conversations (user_a_spotify_user_id, user_b_spotify_user_id)
     VALUES ($1, $2)
     ON CONFLICT (user_a_spotify_user_id, user_b_spotify_user_id)
     DO UPDATE SET user_a_spotify_user_id = EXCLUDED.user_a_spotify_user_id
     RETURNING id`,
    [firstUser, secondUser]
  );
  return result.rows[0].id;
}

async function findPrivateConversation(userA, userB) {
  const [firstUser, secondUser] = [userA, userB].sort();
  if (useMemoryStore) return memoryConversations.get(pairKey(firstUser, secondUser)) ?? null;

  const result = await pool.query(
    `SELECT id FROM private_conversations
     WHERE user_a_spotify_user_id = $1 AND user_b_spotify_user_id = $2`,
    [firstUser, secondUser]
  );
  return result.rows[0]?.id ?? null;
}

async function savePrivateMessage(senderId, recipientId, text) {
  const conversationId = await findPrivateConversation(senderId, recipientId);
  if (!conversationId) throw new Error('Accepted private conversation not found');

  if (useMemoryStore) {
    const key = String(conversationId);
    const messages = memoryPrivateMessages.get(key) ?? [];
    const message = {
      id: randomUUID(),
      from: senderId,
      to: recipientId,
      text,
      ts: Date.now(),
    };
    memoryPrivateMessages.set(key, [...messages, message]);
    return message;
  }

  const result = await pool.query(
    `INSERT INTO private_messages (conversation_id, sender_spotify_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_spotify_user_id, body, created_at`,
    [conversationId, senderId, text]
  );
  const message = toMessage(result.rows[0]);
  return { ...message, to: recipientId };
}

async function getPrivateMessages(userA, userB) {
  const conversationId = await findPrivateConversation(userA, userB);
  if (!conversationId) return [];

  if (useMemoryStore) {
    return (memoryPrivateMessages.get(String(conversationId)) ?? []).slice(-HISTORY_LIMIT);
  }

  const result = await pool.query(
    `SELECT id, sender_spotify_user_id, body, created_at
     FROM private_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [conversationId, HISTORY_LIMIT]
  );
  return result.rows.reverse().map((row) => toMessage(row));
}

async function saveGroupMessage(groupId, senderId, text) {
  if (useMemoryStore) {
    const messages = memoryGroupMessages.get(groupId) ?? [];
    const message = { id: randomUUID(), groupId, from: senderId, text, ts: Date.now() };
    memoryGroupMessages.set(groupId, [...messages, message]);
    return message;
  }

  const result = await pool.query(
    `INSERT INTO group_messages (group_id, sender_spotify_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, group_id, sender_spotify_user_id, body, created_at`,
    [groupId, senderId, text]
  );
  const message = toMessage(result.rows[0]);
  return { ...message, groupId };
}

async function getGroupMessages(groupId) {
  if (useMemoryStore) return (memoryGroupMessages.get(groupId) ?? []).slice(-HISTORY_LIMIT);

  const result = await pool.query(
    `SELECT id, group_id, sender_spotify_user_id, body, created_at
     FROM group_messages
     WHERE group_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [groupId, HISTORY_LIMIT]
  );
  return result.rows.reverse().map((row) => ({ ...toMessage(row), groupId }));
}

module.exports = {
  ensurePrivateConversation,
  findPrivateConversation,
  savePrivateMessage,
  getPrivateMessages,
  saveGroupMessage,
  getGroupMessages,
};
