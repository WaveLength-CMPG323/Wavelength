const axios = require('axios');

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } = process.env;

function basicAuthHeader() {
  return (
    'Basic ' +
    Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  );
}

// Step 3 of the flow: swap the ?code=... from the callback for tokens.
async function exchangeCodeForTokens(code) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(),
      },
    }
  );
  return res.data; // { access_token, refresh_token, expires_in, ... }
}

// Called when a stored access token is expired (or about to expire).
async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(),
      },
    }
  );
  return res.data; // { access_token, expires_in, refresh_token? }
  // Note: Spotify doesn't always send back a new refresh_token - keep the
  // old one if it's missing from this response.
}

// The actual "what's playing" call the Ocean feature needs.
async function getCurrentlyPlaying(accessToken) {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Spotify returns 204 No Content if nothing is playing, which axios
    // surfaces as res.data === '' - normalize that to null.
    return res.data || null;
  } catch (err) {
    if (err.response?.status === 204) return null;
    throw err;
  }
}

// Fetches the real Spotify account behind a token: its id (used to tell
// "two browser tabs, same account" apart from "two different people"),
// display name, public profile link, email, and avatar image.
async function getMyProfile(accessToken) {
  const res = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    spotifyUserId: res.data.id,
    displayName: res.data.display_name || res.data.id,
    profileUrl: res.data.external_urls?.spotify || null,
    // As of Spotify's February 2026 Web API changes, /me no longer
    // returns email at all, for any app at any scope - this will now
    // always resolve to null. Left in place in case Spotify reverses it.
    email: res.data.email || null,
    profileImage: res.data.images?.[0]?.url || null,
  };
}

// The user's recent listening history, for the profile page.
async function getRecentlyPlayed(accessToken, limit = 10) {
  const res = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit },
  });
  return res.data.items.map((item) => ({
    trackId: item.track.id,
    trackUri: item.track.uri,
    name: item.track.name,
    artist: item.track.artists?.map((a) => a.name).join(', '),
    albumArt: item.track.album?.images?.[0]?.url || null,
    playedAt: item.played_at, // ISO timestamp
  }));
}

// The user's playlists, filtered down to public ones only for the profile
// page - private playlists aren't anyone else's business to see there.
async function getPublicPlaylists(accessToken) {
  const res = await axios.get('https://api.spotify.com/v1/me/playlists', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit: 50 },
  });
  return res.data.items
    .filter((p) => p.public === true)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      image: p.images?.[0]?.url || null,
      trackCount: p.tracks?.total ?? 0,
      url: p.external_urls?.spotify || null,
    }));
}

// Playback controls below all require the user to have Spotify Premium
// and an active device (Spotify open somewhere). Spotify returns:
// - 204 No Content on success (nothing useful to return to the caller)
// - 403 Forbidden if the user isn't Premium
// - 404 Not Found if there's no active device to control

async function resumePlayback(accessToken) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/play',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// Starts a SPECIFIC track at a specific position - this is what "joining"
// a song already playing in the ocean uses, so the listener starts near
// the live position instead of from the beginning.
async function playTrackAt(accessToken, trackUri, positionMs) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/play',
    { uris: [trackUri], position_ms: Math.max(0, Math.floor(positionMs || 0)) },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function pausePlayback(accessToken) {
  await axios.put(
    'https://api.spotify.com/v1/me/player/pause',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function skipToNext(accessToken) {
  await axios.post(
    'https://api.spotify.com/v1/me/player/next',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

async function skipToPrevious(accessToken) {
  await axios.post(
    'https://api.spotify.com/v1/me/player/previous',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// NOTE: this used to also export getPublicProfile/getPublicPlaylistsForUser
// (GET /v1/users/{id} and GET /v1/users/{id}/playlists), for viewing an
// ocean host's page. Spotify removed BOTH of those endpoints outright in
// their February 2026 Web API changes - there is now no way, at any scope
// or app access tier, to fetch another person's Spotify profile or
// playlists. routes/spotify.js's GET /user/:spotifyUserId now uses our own
// stored copy of that person's profile (captured when they themselves
// logged into Wavelength) instead of calling Spotify for it.

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  getCurrentlyPlaying,
  getMyProfile,
  getRecentlyPlayed,
  getPublicPlaylists,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
};
