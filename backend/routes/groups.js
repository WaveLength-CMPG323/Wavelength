const express = require('express');
const router = express.Router();

const { getTokens, getTokensBySpotifyUserId } = require('../db/tokenStore');
const chatHistory = require('../db/chatHistory');
// Routes use this store API so its in-memory implementation can later be
// replaced without changing the HTTP endpoints.
const groupStore = require('../lib/groupStore');
const { hasAcceptedPrivateChatRequest } = require('../lib/chatRequests');
const { notifyUsers, removeFromGroupRoom } = require('../lib/groupEvents');
const { getEquippedBorders } = require('../lib/equippedBorders');

// Always get the acting user from their identified bearer token, never from
// request data. req.userId is set by this repo's identifyRequest middleware
// (see lib/identity.js) - the bearer-token equivalent of the teammate's
// original req.sessionID.
async function getCurrentSpotifyUserId(req, res) {
  try {
    const stored = await getTokens(req.userId);
    if (!stored?.spotifyUserId) {
      res.status(401).json({ error: 'You need to log in first' });
      return null;
    }
    return stored.spotifyUserId;
  } catch (error) {
    console.error('Could not identify group user:', error.message);
    res.status(500).json({ error: 'Could not verify your account' });
    return null;
  }
}

function withoutJoinRequests(group) {
  // Pending requests are returned separately, only to group managers.
  const { pendingJoinRequests, ...publicGroup } = group;
  return publicGroup;
}

async function serializeGroup(group) {
  const publicGroup = withoutJoinRequests(group);
  const borders = await getEquippedBorders(publicGroup.members.map((m) => m.spotifyUserId));
  publicGroup.members = await Promise.all(publicGroup.members.map(async (member) => {
    const profile = await getTokensBySpotifyUserId(member.spotifyUserId);
    return {
      ...member,
      // Nickname (if set) takes priority over their Spotify display name,
      // same preference order used for chat requests/friends.
      displayName: profile?.nickname || profile?.displayName || member.spotifyUserId,
      profileImage: profile?.profileImage || null,
      border: borders.get(member.spotifyUserId) ?? null,
    };
  }));
  return publicGroup;
}

function sendStoreError(res, result) {
  const status = result.reason === 'not-found' ? 404
    : result.reason === 'forbidden' ? 403
      : 400;
  res.status(status).json({ error: result.reason });
}

function isGroupModerator(group, spotifyUserId) {
  const member = group.members.find((item) => item.spotifyUserId === spotifyUserId);
  return member?.role === 'owner' || member?.role === 'moderator';
}

router.get('/public', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const groups = await Promise.all((await groupStore.getPublicGroups()).map(serializeGroup));
  res.json({ groups });
});

router.get('/mine', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const groups = await Promise.all((await groupStore.getGroupsForMember(spotifyUserId)).map(serializeGroup));
  res.json({ groups });
});

router.post('/', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const { name, description, icon, visibility, memberSpotifyUserIds } = req.body || {};
  try {
    const group = await groupStore.createGroup({
      name,
      description,
      icon,
      visibility: visibility ?? 'public',
      ownerSpotifyUserId: spotifyUserId,
      memberSpotifyUserIds: Array.isArray(memberSpotifyUserIds) ? memberSpotifyUserIds : [],
    });
    res.status(201).json({ group: await serializeGroup(group) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:groupId', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = await groupStore.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.visibility === 'private' && !(await groupStore.isMember(group.id, spotifyUserId))) {
    return res.status(403).json({ error: 'You are not a member of this private group' });
  }

  res.json({ group: await serializeGroup(group) });
});

// GET /groups/:groupId/messages - message history for a group chat, gated
// on current membership (same check used for sending/joining the socket
// room). Loaded once per thread by the frontend's ChatContext the first
// time that group becomes active - see fetchGroupMessages in lib/api.ts.
router.get('/:groupId/messages', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  try {
    if (!(await groupStore.isMember(req.params.groupId, spotifyUserId))) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    const messages = await chatHistory.getGroupMessages(req.params.groupId);
    res.json({ messages });
  } catch (error) {
    console.error('Could not load group chat history:', error.message);
    res.status(500).json({ error: 'Could not load group chat history' });
  }
});

router.post('/:groupId/join', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const existing = await groupStore.getGroup(req.params.groupId);
  if (!existing) return res.status(404).json({ error: 'Group not found' });
  // Private groups require approval instead of allowing an immediate join.
  if (existing.visibility !== 'public') {
    return res.status(403).json({ error: 'Private groups require a join request' });
  }

  const group = await groupStore.joinPublicGroup(existing.id, spotifyUserId);
  res.json({ group: await serializeGroup(group) });
});

router.post('/:groupId/join-requests', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = await groupStore.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.visibility !== 'private') {
    return res.status(400).json({ error: 'Public groups can be joined directly' });
  }

  const result = await groupStore.requestPrivateGroupJoin(group.id, spotifyUserId);
  res.json(result);
});

router.get('/:groupId/join-requests', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = await groupStore.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!isGroupModerator(group, spotifyUserId)) {
    return res.status(403).json({ error: 'Only owners and moderators can view join requests' });
  }

  res.json({ requests: group.pendingJoinRequests });
});

function resolveJoinRequest(accept) {
  return async (req, res) => {
    const spotifyUserId = await getCurrentSpotifyUserId(req, res);
    if (!spotifyUserId) return;

    const result = await groupStore.resolvePrivateGroupJoin(
      req.params.groupId,
      spotifyUserId,
      req.params.requesterSpotifyUserId,
      accept
    );
    if (!result.ok) return sendStoreError(res, result);

    res.json({ group: await serializeGroup(result.group) });
  };
}

router.post('/:groupId/join-requests/:requesterSpotifyUserId/accept', resolveJoinRequest(true));
router.post('/:groupId/join-requests/:requesterSpotifyUserId/decline', resolveJoinRequest(false));

router.post('/:groupId/leave', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const io = req.app.get('io');
  const result = await groupStore.leaveGroup(req.params.groupId, spotifyUserId);
  if (!result.ok) return sendStoreError(res, result);

  await removeFromGroupRoom(io, spotifyUserId, req.params.groupId);
  if (result.group) {
    await notifyUsers(io, result.group.members.map((m) => m.spotifyUserId), 'group:changed', { groupId: req.params.groupId });
    return res.json({ group: await serializeGroup(result.group) });
  }
  res.json({ group: null, deleted: true });
});

// POST /groups/:groupId/members { memberSpotifyUserIds: [...] } - admin only.
// Like creating a group, you can only add people you're friends with.
router.post('/:groupId/members', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const ids = Array.isArray(req.body?.memberSpotifyUserIds)
    ? req.body.memberSpotifyUserIds.filter((id) => typeof id === 'string' && id)
    : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Pick at least one person to add' });

  for (const id of ids) {
    if (!(await hasAcceptedPrivateChatRequest(spotifyUserId, id))) {
      return res.status(400).json({ error: 'You can only add people you are chatting with' });
    }
  }

  const result = await groupStore.addMembers(req.params.groupId, spotifyUserId, ids);
  if (!result.ok) return sendStoreError(res, result);

  await notifyUsers(
    req.app.get('io'),
    result.group.members.map((m) => m.spotifyUserId),
    'group:changed',
    { groupId: result.group.id }
  );
  res.json({ group: await serializeGroup(result.group), added: result.added });
});

router.delete('/:groupId/members/:memberSpotifyUserId', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const result = await groupStore.removeMember(
    req.params.groupId,
    spotifyUserId,
    req.params.memberSpotifyUserId
  );
  if (!result.ok) return sendStoreError(res, result);

  // The kicked person's group disappears from their chats right away.
  const io = req.app.get('io');
  await removeFromGroupRoom(io, req.params.memberSpotifyUserId, req.params.groupId);
  await notifyUsers(io, [req.params.memberSpotifyUserId], 'group:removed', {
    groupId: req.params.groupId,
    reason: 'kicked',
  });
  await notifyUsers(io, result.group.members.map((m) => m.spotifyUserId), 'group:changed', { groupId: req.params.groupId });

  res.json({ group: await serializeGroup(result.group) });
});

router.patch('/:groupId/members/:memberSpotifyUserId/moderator', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;
  if (typeof req.body?.isModerator !== 'boolean') {
    return res.status(400).json({ error: 'isModerator must be a boolean' });
  }

  const result = await groupStore.setModerator(
    req.params.groupId,
    spotifyUserId,
    req.params.memberSpotifyUserId,
    req.body.isModerator
  );
  if (!result.ok) return sendStoreError(res, result);

  await notifyUsers(
    req.app.get('io'),
    result.group.members.map((m) => m.spotifyUserId),
    'group:changed',
    { groupId: req.params.groupId }
  );
  res.json({ group: await serializeGroup(result.group) });
});

module.exports = router;