const express = require('express');
const router = express.Router();

const { getTokens } = require('../db/tokenStore');
const chatRequests = require('../lib/chatRequests');

// All three routes below need to know the REAL Spotify account behind
// this session (not just the session id) - chat requests are addressed
// to accounts, not sessions, so they survive the recipient logging out
// and back in. This is just a lookup, not a live Spotify API call, so it
// doesn't need getValidAccessToken/a token refresh.
async function getMySpotifyIdentity(req) {
  const stored = await getTokens(req.sessionID);
  if (!stored?.spotifyUserId) return null;
  return {
    spotifyUserId: stored.spotifyUserId,
    displayName: stored.displayName,
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

  const request = chatRequests.createRequest({
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
  res.json({ requests: chatRequests.getIncoming(me.spotifyUserId) });
});

// POST /chat-requests/:id/accept and /decline
async function respondToRequest(req, res, accept) {
  const me = await getMySpotifyIdentity(req);
  if (!me) {
    return res.status(401).json({ error: 'You need to log in first' });
  }
  const request = chatRequests.respond(req.params.id, me.spotifyUserId, accept);
  if (!request) {
    return res.status(404).json({ error: 'That request is no longer pending' });
  }
  res.json({ request });
}

router.post('/:id/accept', (req, res) => respondToRequest(req, res, true));
router.post('/:id/decline', (req, res) => respondToRequest(req, res, false));

module.exports = router;
