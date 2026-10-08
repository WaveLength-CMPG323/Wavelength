// Postgres-backed group CRUD. Used by lib/groupStore.js's dispatcher only
// when DATABASE_URL is set (!useMemoryStore) - this module has no
// memory-store fallback of its own, since lib/groupStore.js already keeps
// the original in-memory implementation for that case.
const pool = require('./pool');

function toMilliseconds(value) {
  return new Date(value).getTime();
}

async function withTransaction(operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getGroup(groupId, queryable = pool) {
  const groupResult = await queryable.query(
    `SELECT id, name, description, icon, visibility, owner_spotify_user_id, created_at
     FROM chat_groups WHERE id = $1`,
    [groupId]
  );
  const row = groupResult.rows[0];
  if (!row) return null;

  const [memberResult, requestResult] = await Promise.all([
    queryable.query(
      `SELECT spotify_user_id, role, joined_at
       FROM chat_group_members WHERE group_id = $1 ORDER BY joined_at, spotify_user_id`,
      [groupId]
    ),
    queryable.query(
      `SELECT spotify_user_id, requested_at
       FROM group_join_requests WHERE group_id = $1 ORDER BY requested_at`,
      [groupId]
    ),
  ]);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    visibility: row.visibility,
    ownerSpotifyUserId: row.owner_spotify_user_id,
    createdAt: toMilliseconds(row.created_at),
    members: memberResult.rows.map((member) => ({
      spotifyUserId: member.spotify_user_id,
      role: member.role,
      joinedAt: toMilliseconds(member.joined_at),
    })),
    pendingJoinRequests: requestResult.rows.map((request) => ({
      spotifyUserId: request.spotify_user_id,
      requestedAt: toMilliseconds(request.requested_at),
    })),
  };
}

async function getPublicGroups() {
  const result = await pool.query(
    `SELECT id FROM chat_groups WHERE visibility = 'public' ORDER BY created_at DESC`
  );
  return Promise.all(result.rows.map((row) => getGroup(row.id)));
}

async function getGroupsForMember(spotifyUserId) {
  const result = await pool.query(
    `SELECT group_id FROM chat_group_members WHERE spotify_user_id = $1 ORDER BY joined_at DESC`,
    [spotifyUserId]
  );
  return Promise.all(result.rows.map((row) => getGroup(row.group_id)));
}

async function createGroup({
  name,
  description = null,
  icon = null,
  visibility = 'public',
  ownerSpotifyUserId,
  memberSpotifyUserIds = [],
}) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) throw new Error('Group name is required');
  if (!ownerSpotifyUserId) throw new Error('Group owner is required');
  if (visibility !== 'public' && visibility !== 'private') {
    throw new Error('Group visibility must be public or private');
  }

  const groupId = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO chat_groups (name, description, icon, visibility, owner_spotify_user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [trimmedName, typeof description === 'string' ? description.trim() || null : null, icon, visibility, ownerSpotifyUserId]
    );
    const id = result.rows[0].id;
    const members = new Set([ownerSpotifyUserId, ...memberSpotifyUserIds]);
    for (const spotifyUserId of members) {
      if (!spotifyUserId) continue;
      await client.query(
        `INSERT INTO chat_group_members (group_id, spotify_user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (group_id, spotify_user_id) DO NOTHING`,
        [id, spotifyUserId, spotifyUserId === ownerSpotifyUserId ? 'owner' : 'member']
      );
    }
    return id;
  });
  return getGroup(groupId);
}

async function isMember(groupId, spotifyUserId, queryable = pool) {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1 FROM chat_group_members WHERE group_id = $1 AND spotify_user_id = $2
     ) AS is_member`,
    [groupId, spotifyUserId]
  );
  return result.rows[0].is_member;
}

async function joinPublicGroup(groupId, spotifyUserId) {
  const group = await withTransaction(async (client) => {
    const result = await client.query(`SELECT visibility FROM chat_groups WHERE id = $1`, [groupId]);
    if (result.rows[0]?.visibility !== 'public') return null;

    await client.query(
      `INSERT INTO chat_group_members (group_id, spotify_user_id, role)
       VALUES ($1, $2, 'member') ON CONFLICT (group_id, spotify_user_id) DO NOTHING`,
      [groupId, spotifyUserId]
    );
    await client.query(
      `DELETE FROM group_join_requests WHERE group_id = $1 AND spotify_user_id = $2`,
      [groupId, spotifyUserId]
    );
    return getGroup(groupId, client);
  });
  return group;
}

async function requestPrivateGroupJoin(groupId, spotifyUserId) {
  return withTransaction(async (client) => {
    const result = await client.query(`SELECT visibility FROM chat_groups WHERE id = $1`, [groupId]);
    if (result.rows[0]?.visibility !== 'private') return null;
    if (await isMember(groupId, spotifyUserId, client)) return { status: 'already-member' };

    const requestResult = await client.query(
      `INSERT INTO group_join_requests (group_id, spotify_user_id)
       VALUES ($1, $2)
       ON CONFLICT (group_id, spotify_user_id) DO UPDATE SET group_id = EXCLUDED.group_id
       RETURNING spotify_user_id, requested_at`,
      [groupId, spotifyUserId]
    );
    const request = requestResult.rows[0];
    return {
      status: 'pending',
      request: { spotifyUserId: request.spotify_user_id, requestedAt: toMilliseconds(request.requested_at) },
    };
  });
}

async function resolvePrivateGroupJoin(groupId, moderatorSpotifyUserId, requesterSpotifyUserId, accept) {
  return withTransaction(async (client) => {
    const roleResult = await client.query(
      `SELECT role FROM chat_group_members WHERE group_id = $1 AND spotify_user_id = $2`,
      [groupId, moderatorSpotifyUserId]
    );
    const role = roleResult.rows[0]?.role;
    if (role !== 'owner' && role !== 'moderator') {
      const exists = await client.query(`SELECT 1 FROM chat_groups WHERE id = $1`, [groupId]);
      return { ok: false, reason: exists.rows.length ? 'forbidden' : 'not-found' };
    }

    const request = await client.query(
      `DELETE FROM group_join_requests
       WHERE group_id = $1 AND spotify_user_id = $2
       RETURNING spotify_user_id`,
      [groupId, requesterSpotifyUserId]
    );
    if (!request.rows[0]) return { ok: false, reason: 'request-not-found' };

    if (accept) {
      await client.query(
        `INSERT INTO chat_group_members (group_id, spotify_user_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT (group_id, spotify_user_id) DO NOTHING`,
        [groupId, requesterSpotifyUserId]
      );
    }
    return { ok: true, group: await getGroup(groupId, client) };
  });
}

// Leaving: anyone may leave. If the ADMIN (owner) leaves, the group is
// handed to the longest-standing moderator (else the longest-standing
// member) so it is never left without an admin. If nobody else is left,
// the group is deleted.
async function leaveGroup(groupId, spotifyUserId) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT g.owner_spotify_user_id, m.spotify_user_id
       FROM chat_groups g
       LEFT JOIN chat_group_members m ON m.group_id = g.id AND m.spotify_user_id = $2
       WHERE g.id = $1`,
      [groupId, spotifyUserId]
    );
    if (!result.rows[0]) return { ok: false, reason: 'not-found' };
    if (!result.rows[0].spotify_user_id) return { ok: false, reason: 'not-a-member' };

    let newOwnerSpotifyUserId = null;
    if (result.rows[0].owner_spotify_user_id === spotifyUserId) {
      const successor = await client.query(
        `SELECT spotify_user_id FROM chat_group_members
         WHERE group_id = $1 AND spotify_user_id <> $2
         ORDER BY CASE WHEN role = 'moderator' THEN 0 ELSE 1 END, joined_at, spotify_user_id
         LIMIT 1`,
        [groupId, spotifyUserId]
      );
      if (!successor.rows[0]) {
        // Last person out - remove the group and everything in it.
        await client.query(`DELETE FROM group_messages WHERE group_id = $1`, [groupId]);
        await client.query(`DELETE FROM group_join_requests WHERE group_id = $1`, [groupId]);
        await client.query(`DELETE FROM chat_group_members WHERE group_id = $1`, [groupId]);
        await client.query(`DELETE FROM chat_groups WHERE id = $1`, [groupId]);
        return { ok: true, group: null, deleted: true };
      }
      newOwnerSpotifyUserId = successor.rows[0].spotify_user_id;
      await client.query(`UPDATE chat_groups SET owner_spotify_user_id = $2 WHERE id = $1`, [groupId, newOwnerSpotifyUserId]);
      await client.query(
        `UPDATE chat_group_members SET role = 'owner' WHERE group_id = $1 AND spotify_user_id = $2`,
        [groupId, newOwnerSpotifyUserId]
      );
    }

    await client.query(`DELETE FROM chat_group_members WHERE group_id = $1 AND spotify_user_id = $2`, [groupId, spotifyUserId]);
    await client.query(`DELETE FROM group_join_requests WHERE group_id = $1 AND spotify_user_id = $2`, [groupId, spotifyUserId]);
    return { ok: true, group: await getGroup(groupId, client), newOwnerSpotifyUserId };
  });
}

// Only the admin (owner) can add people after the group exists. Returns
// which of the given ids were actually new.
async function addMembers(groupId, actorSpotifyUserId, targetSpotifyUserIds) {
  return withTransaction(async (client) => {
    const owner = await client.query(
      `SELECT 1 FROM chat_groups WHERE id = $1 AND owner_spotify_user_id = $2`,
      [groupId, actorSpotifyUserId]
    );
    if (!owner.rows[0]) {
      const exists = await client.query(`SELECT 1 FROM chat_groups WHERE id = $1`, [groupId]);
      return { ok: false, reason: exists.rows.length ? 'forbidden' : 'not-found' };
    }

    const existing = await client.query(
      `SELECT spotify_user_id FROM chat_group_members WHERE group_id = $1`,
      [groupId]
    );
    const alreadyIn = new Set(existing.rows.map((row) => row.spotify_user_id));

    const added = [];
    for (const targetId of new Set(targetSpotifyUserIds)) {
      if (!targetId || alreadyIn.has(targetId)) continue;
      await client.query(
        `INSERT INTO chat_group_members (group_id, spotify_user_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT (group_id, spotify_user_id) DO NOTHING`,
        [groupId, targetId]
      );
      await client.query(`DELETE FROM group_join_requests WHERE group_id = $1 AND spotify_user_id = $2`, [groupId, targetId]);
      added.push(targetId);
    }
    return { ok: true, added, group: await getGroup(groupId, client) };
  });
}

async function removeMember(groupId, actorSpotifyUserId, targetSpotifyUserId) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT actor.role AS actor_role, target.role AS target_role
       FROM chat_groups g
       LEFT JOIN chat_group_members actor ON actor.group_id = g.id AND actor.spotify_user_id = $2
       LEFT JOIN chat_group_members target ON target.group_id = g.id AND target.spotify_user_id = $3
       WHERE g.id = $1`,
      [groupId, actorSpotifyUserId, targetSpotifyUserId]
    );
    if (!result.rows[0]) return { ok: false, reason: 'not-found' };
    const { actor_role: actorRole, target_role: targetRole } = result.rows[0];
    if (actorRole !== 'owner' && actorRole !== 'moderator') return { ok: false, reason: 'forbidden' };
    if (!targetRole) return { ok: false, reason: 'member-not-found' };
    if (targetRole === 'owner') return { ok: false, reason: 'cannot-remove-owner' };
    if (actorRole === 'moderator' && targetRole === 'moderator') {
      return { ok: false, reason: 'moderator-cannot-remove-moderator' };
    }

    await client.query(`DELETE FROM chat_group_members WHERE group_id = $1 AND spotify_user_id = $2`, [groupId, targetSpotifyUserId]);
    await client.query(`DELETE FROM group_join_requests WHERE group_id = $1 AND spotify_user_id = $2`, [groupId, targetSpotifyUserId]);
    return { ok: true, group: await getGroup(groupId, client) };
  });
}

async function setModerator(groupId, ownerSpotifyUserId, targetSpotifyUserId, isModerator) {
  return withTransaction(async (client) => {
    const owner = await client.query(
      `SELECT 1 FROM chat_groups WHERE id = $1 AND owner_spotify_user_id = $2`,
      [groupId, ownerSpotifyUserId]
    );
    if (!owner.rows[0]) {
      const exists = await client.query(`SELECT 1 FROM chat_groups WHERE id = $1`, [groupId]);
      return { ok: false, reason: exists.rows.length ? 'forbidden' : 'not-found' };
    }

    const updated = await client.query(
      `UPDATE chat_group_members SET role = $3
       WHERE group_id = $1 AND spotify_user_id = $2 AND role <> 'owner'
       RETURNING spotify_user_id`,
      [groupId, targetSpotifyUserId, isModerator ? 'moderator' : 'member']
    );
    if (!updated.rows[0]) return { ok: false, reason: 'member-not-found' };
    return { ok: true, group: await getGroup(groupId, client) };
  });
}

module.exports = {
  getGroup,
  getPublicGroups,
  getGroupsForMember,
  createGroup,
  isMember,
  joinPublicGroup,
  requestPrivateGroupJoin,
  resolvePrivateGroupJoin,
  leaveGroup,
  addMembers,
  removeMember,
  setModerator,
};
