const { randomUUID } = require('node:crypto');

// Temporary storage for group data. Replace this module's operations with
// database queries when group tables are available; the API and socket layers
// should depend on these operations, not on the in-memory Map.
const groups = new Map();

function snapshot(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    visibility: group.visibility,
    ownerSpotifyUserId: group.ownerSpotifyUserId,
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

function createGroup({
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

  const group = {
    id: randomUUID(),
    name: trimmedName,
    description: typeof description === 'string' ? description.trim() || null : null,
    icon,
    visibility,
    ownerSpotifyUserId,
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

function getGroup(groupId) {
  const group = groups.get(groupId);
  return group ? snapshot(group) : null;
}

function getPublicGroups() {
  return Array.from(groups.values())
    .filter((group) => group.visibility === 'public')
    .map(snapshot);
}

function getGroupsForMember(spotifyUserId) {
  return Array.from(groups.values())
    .filter((group) => group.members.has(spotifyUserId))
    .map(snapshot);
}

function isMember(groupId, spotifyUserId) {
  return groups.get(groupId)?.members.has(spotifyUserId) ?? false;
}

function joinPublicGroup(groupId, spotifyUserId) {
  const group = groups.get(groupId);
  if (!group || group.visibility !== 'public') return null;

  if (!group.members.has(spotifyUserId)) addMember(group, spotifyUserId);
  group.pendingJoinRequests.delete(spotifyUserId);
  return snapshot(group);
}

function requestPrivateGroupJoin(groupId, spotifyUserId) {
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

function resolvePrivateGroupJoin(groupId, moderatorSpotifyUserId, requesterSpotifyUserId, accept) {
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (!canManageMembers(group, moderatorSpotifyUserId)) return { ok: false, reason: 'forbidden' };

  const request = group.pendingJoinRequests.get(requesterSpotifyUserId);
  if (!request) return { ok: false, reason: 'request-not-found' };

  group.pendingJoinRequests.delete(requesterSpotifyUserId);
  if (accept) addMember(group, requesterSpotifyUserId);

  return { ok: true, group: snapshot(group) };
}

function leaveGroup(groupId, spotifyUserId) {
  const group = groups.get(groupId);
  if (!group) return { ok: false, reason: 'not-found' };
  if (!group.members.has(spotifyUserId)) return { ok: false, reason: 'not-a-member' };
  if (group.ownerSpotifyUserId === spotifyUserId) {
    return { ok: false, reason: 'owner-cannot-leave' };
  }

  group.members.delete(spotifyUserId);
  group.pendingJoinRequests.delete(spotifyUserId);
  return { ok: true, group: snapshot(group) };
}

function removeMember(groupId, actorSpotifyUserId, targetSpotifyUserId) {
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

function setModerator(groupId, ownerSpotifyUserId, targetSpotifyUserId, isModerator) {
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
  removeMember,
  setModerator,
};