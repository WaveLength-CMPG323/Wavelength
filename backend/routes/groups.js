const express = require('express');
const router = express.Router();

const { getTokens, getTokensBySpotifyUserId } = require('../db/tokenStore');
// Routes use this store API so its in-memory implementation can later be
// replaced without changing the HTTP endpoints.
const groupStore = require('../lib/groupStore');

// Always get the acting user from their login session, never from request data.
async function getCurrentSpotifyUserId(req, res) {
  try {
    const stored = await getTokens(req.sessionID);
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
  publicGroup.members = await Promise.all(publicGroup.members.map(async (member) => {
    const profile = await getTokensBySpotifyUserId(member.spotifyUserId);
    return {
      ...member,
      displayName: profile?.displayName || member.spotifyUserId,
      profileImage: profile?.profileImage || null,
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

  const groups = await Promise.all(groupStore.getPublicGroups().map(serializeGroup));
  res.json({ groups });
});

router.get('/mine', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const groups = await Promise.all(groupStore.getGroupsForMember(spotifyUserId).map(serializeGroup));
  res.json({ groups });
});

router.post('/', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const { name, description, icon, visibility } = req.body || {};
  try {
    const group = groupStore.createGroup({
      name,
      description,
      icon,
      visibility: visibility ?? 'public',
      ownerSpotifyUserId: spotifyUserId,
    });
    res.status(201).json({ group: await serializeGroup(group) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:groupId', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = groupStore.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.visibility === 'private' && !groupStore.isMember(group.id, spotifyUserId)) {
    return res.status(403).json({ error: 'You are not a member of this private group' });
  }

  res.json({ group: await serializeGroup(group) });
});

router.post('/:groupId/join', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const existing = groupStore.getGroup(req.params.groupId);
  if (!existing) return res.status(404).json({ error: 'Group not found' });
  // Private groups require approval instead of allowing an immediate join.
  if (existing.visibility !== 'public') {
    return res.status(403).json({ error: 'Private groups require a join request' });
  }

  const group = groupStore.joinPublicGroup(existing.id, spotifyUserId);
  res.json({ group: await serializeGroup(group) });
});

router.post('/:groupId/join-requests', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = groupStore.getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.visibility !== 'private') {
    return res.status(400).json({ error: 'Public groups can be joined directly' });
  }

  const result = groupStore.requestPrivateGroupJoin(group.id, spotifyUserId);
  res.json(result);
});

router.get('/:groupId/join-requests', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const group = groupStore.getGroup(req.params.groupId);
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

    const result = groupStore.resolvePrivateGroupJoin(
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

  const result = groupStore.leaveGroup(req.params.groupId, spotifyUserId);
  if (!result.ok) return sendStoreError(res, result);

  res.json({ group: await serializeGroup(result.group) });
});

router.delete('/:groupId/members/:memberSpotifyUserId', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;

  const result = groupStore.removeMember(
    req.params.groupId,
    spotifyUserId,
    req.params.memberSpotifyUserId
  );
  if (!result.ok) return sendStoreError(res, result);

  res.json({ group: await serializeGroup(result.group) });
});

router.patch('/:groupId/members/:memberSpotifyUserId/moderator', async (req, res) => {
  const spotifyUserId = await getCurrentSpotifyUserId(req, res);
  if (!spotifyUserId) return;
  if (typeof req.body?.isModerator !== 'boolean') {
    return res.status(400).json({ error: 'isModerator must be a boolean' });
  }

  const result = groupStore.setModerator(
    req.params.groupId,
    spotifyUserId,
    req.params.memberSpotifyUserId,
    req.body.isModerator
  );
  if (!result.ok) return sendStoreError(res, result);

  res.json({ group: await serializeGroup(result.group) });
});

module.exports = router;