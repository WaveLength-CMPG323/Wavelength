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
    // Follower count for the AUTHENTICATED user's own profile - this is
    // distinct from the third-party GET /users/{id} endpoint Spotify
    // removed in Feb 2026 (see the note near the bottom of this file);
    // GET /me for yourself still returns your own followers.total with no
    // extra scope needed. Bundled in here rather than a separate call
    // since /me already has it.
    followers: res.data.followers?.total ?? null,
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

// How many artists this user follows - Spotify's "Get Followed Artists"
// endpoint (a GET /me/... call, not a third-party lookup, so it's unaffected
// by the Feb 2026 removals). Only the total is needed for the profile page's
// "following" count, so limit=1 keeps the response tiny. Requires the
// user-follow-read scope - a 403 here (missing scope, e.g. someone who
// hasn't re-logged-in since it was added) is left for the calling route to
// translate into a friendly message, same pattern as elsewhere in this file.
async function getFollowingCount(accessToken) {
  const res = await axios.get('https://api.spotify.com/v1/me/following', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { type: 'artist', limit: 1 },
  });
  return res.data.artists?.total ?? 0;
}

// The user's top 5 genres, derived from their top artists (Spotify has no
// direct "top genres" endpoint) - each top artist carries a genres[] array,
// so this fetches a reasonable batch of top artists (short_term, i.e.
// roughly last 4 weeks) and counts genre frequency across all of them.
// Requires the user-top-read scope. A very new/sparse-history account may
// simply have few or no genres to find - callers/frontend should treat an
// empty array as "not enough listening history yet", not an error.
async function getTopGenres(accessToken, limit = 5) {
  const res = await axios.get('https://api.spotify.com/v1/me/top/artists', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { time_range: 'short_term', limit: 20 },
  });
  const counts = new Map();
  for (const artist of res.data.items || []) {
    for (const genre of artist.genres || []) {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
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
      // Spotify's Feb 2026 API changes renamed the playlist `tracks` field to
      // `items`, so read either. null (not 0) when Spotify doesn't tell us, so
      // the UI can hide the count instead of claiming "0 tracks".
      trackCount: [p.items?.total, p.tracks?.total].find((n) => Number.isFinite(n)) ?? null,
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
//
// The target device is chosen explicitly. Without a device_id Spotify sends
// the command to whatever it remembers as the account's "active" device,
// and it answers 204 (success) even when that device is stale - an app that
// was closed, a phone that went to sleep, or a different device from the one
// the person is looking at - so the song never starts anywhere they can hear.
// GET /me/player/devices only lists devices that are online right now, so we
// aim at one of those instead.
async function pickPlaybackDevice(accessToken) {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const devices = (res.data?.devices || []).filter((d) => d.id && !d.is_restricted);
    return devices.find((d) => d.is_active) || devices[0] || null;
  } catch {
    return null; // fall back to Spotify's own choice rather than failing the join
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Moves the account's playback to this device (without starting anything).
// An idle phone usually only starts listening to remote "play" commands
// after it has been made the active device like this.
async function transferPlayback(accessToken, deviceId) {
  await axios.put(
    'https://api.spotify.com/v1/me/player',
    { device_ids: [deviceId], play: false },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// What Spotify says the account is doing right now: is it playing this
// track, plus a short summary of the player (for the logs and the join
// response, so a phone that ignores commands can be diagnosed).
async function checkPlayer(accessToken, trackUri) {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = res.status === 200 ? res.data : null;
    if (!d) return { playing: false, state: null };
    return {
      playing: !!(d.is_playing && (d.item?.uri === trackUri || d.item?.linked_from?.uri === trackUri)),
      state: {
        isPlaying: !!d.is_playing,
        track: d.item?.name || null,
        device: d.device?.name || null,
        deviceActive: d.device?.is_active ?? null,
        volume: d.device?.volume_percent ?? null,
        privateSession: d.device?.is_private_session ?? null,
        disallows: Object.keys(d.actions?.disallows || {}),
      },
    };
  } catch (err) {
    return { playing: false, state: { error: err.response?.status || err.message } };
  }
}

// Polls for up to `ms`, because a phone that was asleep can take several
// seconds to start after Spotify says "204 accepted".
async function waitUntilPlaying(accessToken, trackUri, ms) {
  let last = { playing: false, state: null };
  for (let waited = 0; waited < ms; waited += 1000) {
    await sleep(1000);
    last = await checkPlayer(accessToken, trackUri);
    if (last.playing) break;
  }
  return last;
}

// `verify: true` (used by the "Listen on Spotify" button, where the person is
// waiting) re-checks after a moment that the song really started and, if the
// phone ignored the first command, sends it once more. Returns
// { device, status, playing } - `playing` is null when it wasn't checked.
async function playTrackAt(accessToken, trackUri, positionMs, { verify = false, albumUri = null } = {}) {
  const device = await pickPlaybackDevice(accessToken);
  const position_ms = Math.max(0, Math.floor(positionMs || 0));
  const urisBody = { uris: [trackUri], position_ms };
  // Spotify now accepts the plain track-list request (urisBody) with a 204
  // and then loads nothing, so the primary request asks for the same track
  // inside its album instead; the track list stays as the fallback.
  const albumBody = albumUri ? { context_uri: albumUri, offset: { uri: trackUri }, position_ms } : null;
  const body = albumBody || urisBody;
  const config = {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(device ? { params: { device_id: device.id } } : {}),
  };

  // A device that isn't the active one is woken up first.
  if (device && !device.is_active) {
    try {
      await transferPlayback(accessToken, device.id);
      await sleep(900);
    } catch {
      // Not fatal - the play command below still names the device.
    }
  }

  let res = await axios.put('https://api.spotify.com/v1/me/player/play', body, config);
  let playing = null;

  let player = null;
  let method = albumBody ? 'album-context' : 'uris';
  if (verify) {
    player = await waitUntilPlaying(accessToken, trackUri, 4000);
    if (!player.playing) {
      // The first request was accepted but nothing started: try the other kind.
      const retryBody = albumBody ? urisBody : body;
      method = albumBody ? 'uris (fallback)' : 'uris (retry)';
      res = await axios.put('https://api.spotify.com/v1/me/player/play', retryBody, config);
      player = await waitUntilPlaying(accessToken, trackUri, 4000);
    }
    playing = player.playing;
  }

  // device: which device we aimed at; status: Spotify's answer (204 = done,
  // 202 = accepted but the device was slow/unavailable).
  return { device: device ? { name: device.name, type: device.type } : null, status: res.status, playing, method, player: player ? player.state : null };
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

// "Save to Liked Songs" - Spotify's actual Liked Songs library IS the
// user's saved-tracks list, so saving here is the same thing as adding a
// track to it. Requires the user-library-modify scope (see routes/auth.js).
async function saveTrackToLibrary(accessToken, trackId) {
  await axios.put(
    'https://api.spotify.com/v1/me/tracks',
    { ids: [trackId] },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// Spotify tracks don't carry a genre themselves - genre only exists on
// ARTIST objects. This fetches the primary artist's genre list for
// whatever track is currently playing, used to let Ocean search match on
// genre and to show genre tags in the song panel. Callers should cache
// this (see lib/genreCache.js) rather than calling it on every poll - an
// artist's genres essentially never change, and Spotify's API has
// per-app rate limits shared across every session.
async function getArtistGenres(accessToken, artistId) {
  const res = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.genres || [];
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
  getFollowingCount,
  getTopGenres,
  getPublicPlaylists,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  saveTrackToLibrary,
  getArtistGenres,
};
