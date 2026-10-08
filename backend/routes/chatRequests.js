const express = require('express');
const router = express.Router();

const { getTokens, getTokensBySpotifyUserId } = require('../db/tokenStore');
const chatHistory = require('../db/chatHistory');
const chatRequests = require('../lib/chatRequests');
const { getEquippedBorders } = require('../lib/equippedBorders');

// All routes below need to know the REAL Spotify account behind
// this session (not just the session id) - chat requests are addressed
// to accounts, not sessions, so they survive the recipient logging out
// and back in. This is just a lookup, not a live Spotify API call, so it
// doesn't need getValidAccessToken/a token refresh.
async function getMySpotifyIdentity(req) {
  const stored = await getTokens(req.userId);
  if (!stored?.spotifyUserId) return null;
  return {
    spotifyUserId: stored.spotifyUserId,
    // Nickname (if set) takes priority over the Spotify display name
    // everywhere a chat request shows who sent it - see
    // lib/chatRequests.js's fromRow.
    displayName: stored.nickname || stored.displayName,
    profileImage: stored.profileImage,
  };
}

// POST /chat-requests { toSpotifyUserId } - send a chat request to
// someone else's real Spotify account. This is just the request itself;
// actual chat isn't built yet.
router.post('/', async (req, res) => {
  const { toSpotifyUserId } = req.body || {};
  if (!toSpotifyUserId) {
    return res.status(400).json({ error: 'toSpotifyUserId is required' });
  }

  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  if (me.spotifyUserId === toSpotifyUserId) {
    return res.status(400).json({ error: "You can't request a chat with yourself" });
  }
  if (await chatRequests.hasAcceptedPrivateChatRequest(me.spotifyUserId, toSpotifyUserId)) {
    return res.status(400).json({ error: "You're already chatting with this person" });
  }

  const request = await chatRequests.createRequest({
    fromSpotifyUserId: me.spotifyUserId,
    fromDisplayName: me.displayName,
    fromProfileImage: me.profileImage,
    toSpotifyUserId,
  });
  res.json({ request });
});

// GET /chat-requests/incoming - pending requests addressed to me, for the
// Notifications tab.
router.get('/incoming', async (req, res) => {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.json({ requests: [] }); // not logged in - nothing to show, not an error
  }
  try {
    const requests = await chatRequests.getIncoming(me.spotifyUserId);
    const borders = await getEquippedBorders(requests.map((r) => r.fromSpotifyUserId));
    res.json({ requests: requests.map((r) => ({ ...r, fromBorder: borders.get(r.fromSpotifyUserId) ?? null })) });
  } catch (error) {
    console.error('Could not load incoming chat requests:', error.message);
    res.status(500).json({ error: 'Could not load notifications' });
  }
});

// POST /chat-requests/:id/accept and /decline
async function respondToRequest(req, res, accept) {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  const request = await chatRequests.respond(req.params.id, me.spotifyUserId, accept);
  if (!request) {
    return res.status(404).json({ error: 'That request is no longer pending' });
  }
  res.json({ request });
}

router.post('/:id/accept', (req, res) => respondToRequest(req, res, true));
router.post('/:id/decline', (req, res) => respondToRequest(req, res, false));

// GET /chat-requests/accepted - real chat "friends": everyone with an
// accepted request in either direction, with enough profile info to show
// them in the Chat page's friends list.
router.get('/accepted', async (req, res) => {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  try {
    const requests = await chatRequests.getAccepted(me.spotifyUserId);
    const otherIds = requests.map((request) =>
      request.fromSpotifyUserId === me.spotifyUserId ? request.toSpotifyUserId : request.fromSpotifyUserId
    );
    const borders = await getEquippedBorders(otherIds);
    const chats = await Promise.all(
      requests.map(async (request) => {
        const otherSpotifyUserId =
          request.fromSpotifyUserId === me.spotifyUserId
            ? request.toSpotifyUserId
            : request.fromSpotifyUserId;
        const profile = await getTokensBySpotifyUserId(otherSpotifyUserId);
        return {
          requestId: request.id,
          spotifyUserId: otherSpotifyUserId,
          // Nickname (if they've set one) takes priority over their
          // Spotify display name; falls back to the raw account id only
          // if neither is known at all.
          displayName: profile?.nickname || profile?.displayName || otherSpotifyUserId,
          profileImage: profile?.profileImage || null,
          border: borders.get(otherSpotifyUserId) ?? null,
        };
      })
    );
    res.json({ chats });
  } catch (error) {
    console.error('Could not load accepted chats:', error.message);
    res.status(500).json({ error: 'Could not load accepted chats' });
  }
});

// POST /chat-requests/:id/revoke - "unfriend": either party can revoke an
// already-accepted request, which immediately closes the private chat room
// (hasAcceptedPrivateChatRequest starts returning false for this pair).
router.post('/:id/revoke', async (req, res) => {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  const request = await chatRequests.revoke(req.params.id, me.spotifyUserId);
  if (!request) {
    return res.status(404).json({ error: 'That request is not currently accepted' });
  }
  res.json({ request });
});

// GET /chat-requests/:otherUserId/messages - private message history,
// gated on an accepted chat request between us (same gate used for the
// live socket room). Loaded once per thread by the frontend's ChatContext
// the first time that thread becomes active - see fetchPrivateMessages in
// lib/api.ts.
router.get('/:otherUserId/messages', async (req, res) => {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  try {
    const otherUserId = req.params.otherUserId;
    if (!(await chatRequests.hasAcceptedPrivateChatRequest(me.spotifyUserId, otherUserId))) {
      return res.status(403).json({ error: 'You do not have an accepted chat with this user' });
    }

    const messages = await chatHistory.getPrivateMessages(me.spotifyUserId, otherUserId);
    res.json({ messages });
  } catch (error) {
    console.error('Could not load private chat history:', error.message);
    res.status(500).json({ error: 'Could not load private chat history' });
  }
});

module.exports = router;
