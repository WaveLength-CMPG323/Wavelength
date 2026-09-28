// Chat REQUESTS only - not chat itself (that's a future feature). Tracks
// "person A wants to start a chat with person B" so it can show up in
// B's Notifications and be accepted/declined.
//
// Keyed by real Spotify account id (spotifyUserId), not session id -
// unlike oceanState (which is deliberately ephemeral per-session), a
// pending request needs to survive the recipient logging out and back in,
// or checking from a different browser/device, since "chat account" here
// just means "whichever real Spotify account this is."
//
// In-memory and lost on restart, same tradeoff as everything else in this
// project pre-database. Fine for now; would need a real table to survive
// a server restart in production.

const requests = new Map(); // id -> request
let nextId = 1;

// Creates a new pending request, unless an identical one (same two
// people, still pending) already exists - returns that instead of
// spamming duplicates if someone double-clicks "Request Chat".
function createRequest({ fromSpotifyUserId, fromDisplayName, fromProfileImage, toSpotifyUserId }) {
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
function getIncoming(spotifyUserId) {
  return Array.from(requests.values())
    .filter((r) => r.toSpotifyUserId === spotifyUserId && r.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Accepts or declines a request - only the recipient can respond to it.
// Returns null if the request doesn't exist, isn't theirs, or was already
// responded to (so a double-click can't flip an already-accepted request).
function respond(id, spotifyUserId, accept) {
  const r = requests.get(id);
  if (!r || r.toSpotifyUserId !== spotifyUserId || r.status !== 'pending') return null;
  r.status = accept ? 'accepted' : 'declined';
  return r;
}

module.exports = { createRequest, getIncoming, respond };
