const { randomUUID } = require('node:crypto');
const { useMemoryStore } = require('../db/tokenStore');
const postgresGroupStore = require('../db/groupStore');

// Temporary storage for group data when DATABASE_URL isn't set. When it is
// set, every function below delegates to db/groupStore.js (real Postgres
// persistence) instead - this in-memory branch only exists so local dev
// without Postgres still works exactly as it did before persistence was
// added. The API and socket layers should depend on this module's exported
// operations, not on the Map directly.
const groups = new Map();

function snapshot(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    visibility: group.visibility,
    ownerSpotifyUserId: group.ownerSpotifyUserId,
    createdAt: group.createdAt,
    members: Array.from(group.members.values(), (member) => ({ ...member })),
    pendingJoinRequests: Array.from(group.pendingJoinRequests.values(), (request) => ({ ...request })),
  };
}

function addMember(group, spotifyUserId, role = 'member') {
  group.members.set(spotifyUserId, {
    spotifyUserId,
    role,
    joinedAt: Date.now(),
  });
}

function canManageMembers(group, spotifyUserId) {
  const role = group.members.get(spotifyUserId)?.role;
  return role === 'owner' || role === 'moderator';
}

async function createGroup({
  name,
  description = null,
  icon = null,
  visibility = 'public',
  ownerSpotifyUserId,
  memberSpotifyUserIds = [],
}) {
  if (!useMemoryStore) {
    return postgresGroupStore.createGroup({
      name,
      description,
      icon,
      visibility,
      ownerSpotifyUserId,
      memberSpotifyUserIds,
    });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) throw new Error('Group name is required');
  if (!ownerSpotifyUserId) throw new Error('Group owner is required');
  if (visibility !== 'public' && visibility !== 'private') {
    throw new Error('Group visibility must be public or private');
  }

  const group = {
    id: randomUUID(),
    name: trimmedName,
    description: typeof description === 'string' ? description.trim() || null : null,
    icon,
    visibility,
    ownerSpotifyUserId,
    createdAt: Date.now(),
    members: new Map(),
    pendingJoinRequests: new Map(),
  };

  addMember(group, ownerSpotifyUserId, 'owner');
  for (const spotifyUserId of new Set(memberSpotifyUserIds)) {
    if (spotifyUserId && spotifyUserId !== ownerSpotifyUserId) {
      addMember(group, spotifyUserId);
    }
  }

  groups.set(group.id, group);
  return snapshot(group);
}

async function getGroup(groupId) {
  if (!useMemoryStore) return postgresGroupStore.getGroup(groupId);
  const group = groups.get(groupId);
  return group ? snapshot(group) : null;
}

async function getPublicGroups() {
  if (!useMemoryStore) return postgresGroupStore.getPublicGroups();
  return Array.from(groups.values())
    .filter((group) => group.visibility === 'public')
    .map(snapshot);
}

async function getGroupsForMember(spotifyUserId) {
  if (!useMemoryStore) return postgresGroupStore.getGroupsForMember(spotifyUserId);
  return Array.from(groups.values())
    .filter((group) => group.members.has(spotifyUserId))
    .map(snapshot);
}

async function isMember(groupId, spotifyUserId) {
  if (!useMemoryStore) return postgresGroupStore.isMember(groupId, spotifyUserId);
  return groups.get(groupId)?.members.has(spotifyUserId) ?? false;
}

async function joinPublicGroup(groupId, spotifyUserId) {
  if (!useMemoryStore) return postgresGroupStore.joinPublicGroup(groupId, spotifyUserId);
  const group = groups.get(groupId);
  if (!group || group.visibility !== 'public') return null;

  if (!group.members.has(spotifyUserId)) addMember(group, spotifyUserId);
  group.pendingJoinRequests.delete(spotifyUserId);
  return snapshot(group);
}

async function requestPrivateGroupJoin(groupId, spotifyUserId) {
  if (!useMemoryStore) return postgresGroupStore.requestPrivateGroupJoin(groupId, spotifyUserId);
  const group = groups.get(groupId);
  if (!group || group.visibility !== 'private') return null;
  if (group.members.has(spotifyUserId)) return { status: 'already-member' };

  let request = group.pendingJoinRequests.get(spotifyUserId);
  if (!request) {
    request = { spotifyUserId, requestedAt: Date.now() };
    group.pendingJoinRequests.set(spotifyUserId, request);
  }

  return { status: 'pending', request: { ...request } };
}

async function resolvePrivateGroupJoin(groupId, moderatorSpotifyUserId, requesterSpotifyUserId, accept) {
  if (!useMemoryStore) {
    return postgresGroupStore.resolvePrivateGroupJoin(
      groupId,
      moderatorSpotifyUserId,
      requesterSpotifyUserId,
      accept
    );
  }
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (!canManageMembers(group, moderatorSpotifyUserId)) return { ok: false, reason: 'forbidden' };

  const request = group.pendingJoinRequests.get(requesterSpotifyUserId);
  if (!request) return { ok: false, reason: 'request-not-found' };

  group.pendingJoinRequests.delete(requesterSpotifyUserId);
  if (accept) addMember(group, requesterSpotifyUserId);

  return { ok: true, group: snapshot(group) };
}

async function leaveGroup(groupId, spotifyUserId) {
  if (!useMemoryStore) return postgresGroupStore.leaveGroup(groupId, spotifyUserId);
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (!group.members.has(spotifyUserId)) return { ok: false, reason: 'not-a-member' };

  // Admin leaving hands the group to the longest-standing moderator (else
  // member); if nobody is left the group is deleted. Same rule as Postgres.
  let newOwnerSpotifyUserId = null;
  if (group.ownerSpotifyUserId === spotifyUserId) {
    const others = Array.from(group.members.values())
      .filter((member) => member.spotifyUserId !== spotifyUserId)
      .sort((a, b) => (a.role === 'moderator' ? 0 : 1) - (b.role === 'moderator' ? 0 : 1) || a.joinedAt - b.joinedAt);
    if (others.length === 0) {
      groups.delete(groupId);
      return { ok: true, group: null, deleted: true };
    }
    newOwnerSpotifyUserId = others[0].spotifyUserId;
    group.ownerSpotifyUserId = newOwnerSpotifyUserId;
    others[0].role = 'owner';
  }

  group.members.delete(spotifyUserId);
  group.pendingJoinRequests.delete(spotifyUserId);
  return { ok: true, group: snapshot(group), newOwnerSpotifyUserId };
}

async function addMembers(groupId, actorSpotifyUserId, targetSpotifyUserIds) {
  if (!useMemoryStore) return postgresGroupStore.addMembers(groupId, actorSpotifyUserId, targetSpotifyUserIds);
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (group.ownerSpotifyUserId !== actorSpotifyUserId) return { ok: false, reason: 'forbidden' };

  const added = [];
  for (const targetId of new Set(targetSpotifyUserIds)) {
    if (!targetId || group.members.has(targetId)) continue;
    addMember(group, targetId);
    group.pendingJoinRequests.delete(targetId);
    added.push(targetId);
  }
  return { ok: true, added, group: snapshot(group) };
}

async function removeMember(groupId, actorSpotifyUserId, targetSpotifyUserId) {
  if (!useMemoryStore) {
    return postgresGroupStore.removeMember(groupId, actorSpotifyUserId, targetSpotifyUserId);
  }
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (!canManageMembers(group, actorSpotifyUserId)) return { ok: false, reason: 'forbidden' };

  const actorRole = group.members.get(actorSpotifyUserId)?.role;
  const target = group.members.get(targetSpotifyUserId);
  if (!target) return { ok: false, reason: 'member-not-found' };
  if (target.role === 'owner') return { ok: false, reason: 'cannot-remove-owner' };
  if (actorRole === 'moderator' && target.role === 'moderator') {
    return { ok: false, reason: 'moderator-cannot-remove-moderator' };
  }

  group.members.delete(targetSpotifyUserId);
  group.pendingJoinRequests.delete(targetSpotifyUserId);
  return { ok: true, group: snapshot(group) };
}

async function setModerator(groupId, ownerSpotifyUserId, targetSpotifyUserId, isModerator) {
  if (!useMemoryStore) {
    return postgresGroupStore.setModerator(groupId, ownerSpotifyUserId, targetSpotifyUserId, isModerator);
  }
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (group.ownerSpotifyUserId !== ownerSpotifyUserId) return { ok: false, reason: 'forbidden' };

  const target = group.members.get(targetSpotifyUserId);
  if (!target || target.role === 'owner') return { ok: false, reason: 'member-not-found' };

  target.role = isModerator ? 'moderator' : 'member';
  return { ok: true, group: snapshot(group) };
}

module.exports = {
  createGroup,
  getGroup,
  getPublicGroups,
  getGroupsForMember,
  isMember,
  joinPublicGroup,
  requestPrivateGroupJoin,
  resolvePrivateGroupJoin,
  leaveGroup,
  addMembers,
  removeMember,
  setModerator,
};
