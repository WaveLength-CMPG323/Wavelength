const express = require('express');
const router = express.Router();

const {
  getCurrentlyPlaying,
  resumePlayback,
  playTrackAt,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  getRecentlyPlayed,
  getPublicPlaylists,
  getMyProfile,
  getFollowingCount,
  getTopGenres,
  saveTrackToLibrary,
} = require('../lib/spotifyClient');
const { getValidAccessToken } = require('../lib/authHelper');
const { getTokens, getTokensBySpotifyUserId, saveProfileDetails } = require('../db/tokenStore');
const oceanState = require('../lib/oceanState');
const { getQuotaStatus } = require('../lib/spotifyQuota');
const { getEquippedBorders } = require('../lib/equippedBorders');

// GET /spotify/quota - is Spotify currently rate-limiting the app? Public
// (guests see the ocean too); the frontend also gets live changes over the
// 'spotify:quota' socket event, this is the "what's the state right now" call.
router.get('/quota', (req, res) => {
  res.json(getQuotaStatus());
});

// GET /spotify/currently-playing
// Used by the standalone test dashboard (routes/spotify.js is separate
// from the ocean page's group-based data, which comes over Socket.IO).
router.get('/currently-playing', async (req, res) => {
  try {
    // Same session id used at login time - this identifies which
    // browser/person is asking, without needing real accounts yet.
    const userId = req.userId;

    const accessToken = await getValidAccessToken(userId);
    const data = await getCurrentlyPlaying(accessToken);

    if (!data) {
      return res.json({ playing: false });
    }

    res.json({
      playing: data.is_playing,
      trackId: data.item?.id,
      track: data.item?.name,
      artist: data.item?.artists?.map((a) => a.name).join(', '),
      albumArt: data.item?.album?.images?.[0]?.url, // largest available image
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms,
    });
  } catch (err) {
    console.error('currently-playing failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch currently-playing data' });
  }
});

// Shared handler for the four control endpoints below - they all follow
// the same pattern: get a valid token, call the Spotify action, and
// translate Spotify's specific error codes into clearer messages.
function makeControlRoute(action) {
  return async (req, res) => {
    try {
      const userId = req.userId;
      const accessToken = await getValidAccessToken(userId);
      await action(accessToken);
      res.json({ success: true });
    } catch (err) {
      const status = err.response?.status;
      const spotifyMessage = err.response?.data?.error?.message;

      if (status === 401 && spotifyMessage === 'Permissions missing') {
        return res.status(401).json({
          error: 'Your login is missing the playback-control permission. Log out and log in again to grant it.',
        });
      }
      if (status === 403) {
        return res
          .status(403)
          .json({ error: 'This action requires Spotify Premium.' });
      }
      if (status === 404) {
        return res.status(404).json({
          error: 'No active Spotify device found. Open Spotify on a device first.',
        });
      }

      console.error('playback control failed:', err.response?.data || err.message);
      res.status(500).json({ error: 'Could not complete playback action' });
    }
  };
}

router.put('/play', makeControlRoute(resumePlayback));
router.put('/pause', makeControlRoute(pausePlayback));
router.post('/next', makeControlRoute(skipToNext));
router.post('/previous', makeControlRoute(skipToPrevious));

// POST /spotify/join
// Called when someone clicks a bubble on the ocean page. Starts that
// track on THEIR Spotify at (roughly) the live position everyone else
// is at, and folds them into that song's listener group.
router.post('/join', async (req, res) => {
  const { trackUri, trackId } = req.body || {};
  if (!trackUri || !trackId) {
    return res.status(400).json({ error: 'trackUri and trackId are required' });
  }

  try {
    const userId = req.userId;

    // If they were following someone, a deliberate manual join means
    // they're choosing to do their own thing now - otherwise the
    // follow-sync loop would just snap them back to the host's track
    // on the very next poll cycle.
    oceanState.clearFollow(userId);

    // The actual bug fix: if this session is already anchoring/part of
    // this track's group (whether paused or playing), calling Spotify's
    // play endpoint again on ourselves interrupts our own playback
    // instead of "joining" anything - so just no-op instead.
    if (oceanState.isSessionInGroup(userId, trackId)) {
      return res.json({ success: true, alreadyListening: true });
    }

    const accessToken = await getValidAccessToken(userId);

    const groups = oceanState.computeGroups();
    const group = groups.find((g) => g.trackId === trackId);
    const positionMs = group ? oceanState.getLiveProgressMs(group) : 0;

    await playTrackAt(accessToken, trackUri, positionMs);
    res.json({ success: true, joinedAtMs: positionMs });
  } catch (err) {
    const status = err.response?.status;
    const spotifyMessage = err.response?.data?.error?.message;

    if (status === 401 && spotifyMessage === 'Permissions missing') {
      return res.status(401).json({
        error: 'Your login is missing the playback-control permission. Log out and log in again to grant it.',
      });
    }
    if (status === 403) {
      return res.status(403).json({ error: 'This action requires Spotify Premium.' });
    }
    if (status === 404) {
      return res.status(404).json({
        error: 'No active Spotify device found. Open Spotify on a device first.',
      });
    }

    console.error('join failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not join this song' });
  }
});

// POST /spotify/follow
// "Follow Along": keep following whoever is currently hosting this
// track, even as they change songs - handled by the background poller's
// syncFollowers(). If that host later disappears, host succession
// (also in the poller) promotes the next-earliest follower automatically.
router.post('/follow', async (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }

  const userId = req.userId;
  const groups = oceanState.computeGroups();
  const group = groups.find((g) => g.trackId === trackId);
  if (!group) {
    return res.status(404).json({ error: 'That song is no longer playing' });
  }
  if (group.hostSessionId === userId) {
    return res.status(400).json({ error: "You can't follow yourself" });
  }

  oceanState.setFollow(userId, group.hostSessionId);
  res.json({ success: true });
});

// POST /spotify/unfollow
router.post('/unfollow', (req, res) => {
  oceanState.clearFollow(req.userId);
  res.json({ success: true });
});

// GET /spotify/follow-status - lets the frontend correctly restore the
// Follow Along toggle when a song panel is reopened (or the page is
// refreshed), instead of always assuming "not following". Also reports the
// last background-sync error (if any) - see spotifyPoller.js's
// syncFollowers() - so a Follow Along that's silently failing every cycle
// (no Premium, no active device, etc.) actually tells the person why,
// instead of just sitting there looking "on" and doing nothing.
router.get('/follow-status', (req, res) => {
  const follow = oceanState.getFollow(req.userId);
  res.json({
    followingHostSessionId: follow?.hostSessionId ?? null,
    lastError: follow?.lastError ?? null,
  });
});

// GET /spotify/user/:spotifyUserId - a host's read-only Wavelength
// profile page: their name, avatar, and profile link.
//
// As of Spotify's February 2026 Web API changes, GET /users/{id} and
// GET /users/{id}/playlists (both third-party endpoints - i.e. "look up
// someone ELSE's info") were removed outright. There is no longer any way
// to fetch another person's Spotify profile or playlists via the API,
// regardless of scopes or app access tier - so this no longer calls
// Spotify at all. Instead it looks up OUR OWN stored copy of that
// person's profile info, captured whenever they themselves logged into
// Wavelength (see routes/auth.js's /callback). No playlists here anymore:
// there is no remaining Spotify endpoint that can supply someone else's,
// full stop.
router.get('/user/:spotifyUserId', async (req, res) => {
  try {
    await getValidAccessToken(req.userId); // just confirms the viewer is logged in
  } catch (err) {
    console.error('user profile fetch: no valid token for viewer:', err.message);
    return res.status(401).json({ error: 'You need to log in first' });
  }

  const { spotifyUserId } = req.params;
  const stored = await getTokensBySpotifyUserId(spotifyUserId);
  if (!stored) {
    return res.status(404).json({ error: "This person hasn't logged into Wavelength" });
  }

  const borders = await getEquippedBorders([stored.spotifyUserId]);
  res.json({
    profile: {
      spotifyUserId: stored.spotifyUserId,
      displayName: stored.displayName,
      profileUrl: stored.profileUrl,
      profileImage: stored.profileImage,
      nickname: stored.nickname ?? null,
      bio: stored.bio ?? null,
      border: borders.get(stored.spotifyUserId) ?? null,
    },
  });
});

// PUT /spotify/profile { nickname, bio } - saves the logged-in person's
// own nickname/bio (shown on their own profile page, on their public
// Wavelength profile via GET /user/:spotifyUserId above, and preferred
// over their Spotify display name in chats/friends/groups - see
// lib/chatRequests.js, routes/chatRequests.js and routes/groups.js).
router.put('/profile', async (req, res) => {
  const stored = await getTokens(req.userId);
  if (!stored?.spotifyUserId) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  const { nickname, bio } = req.body || {};
  if (nickname !== undefined && typeof nickname !== 'string') {
    return res.status(400).json({ error: 'nickname must be a string' });
  }
  if (bio !== undefined && typeof bio !== 'string') {
    return res.status(400).json({ error: 'bio must be a string' });
  }

  try {
    const trimmedNickname = nickname !== undefined ? nickname.trim() : undefined;
    const trimmedBio = bio !== undefined ? bio.trim() : undefined;
    await saveProfileDetails(stored.spotifyUserId, { nickname: trimmedNickname, bio: trimmedBio });
    res.json({
      success: true,
      nickname: trimmedNickname ?? stored.nickname ?? null,
      bio: trimmedBio ?? stored.bio ?? null,
    });
  } catch (error) {
    console.error('Could not save profile details:', error.message);
    res.status(500).json({ error: 'Could not save your nickname/bio' });
  }
});

// GET /spotify/recently-played - for the profile page's listening history.
// Requires the user-read-recently-played scope - anyone who logged in
// before that scope was added needs to log out and back in once.
router.get('/recently-played', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.userId);
    const items = await getRecentlyPlayed(accessToken, 5);
    res.json({ items });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission for listening history. Log out and log in again to grant it.',
      });
    }
    console.error('recently-played failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch recently played tracks' });
  }
});

// GET /spotify/playlists - the user's PUBLIC playlists only, for the
// profile page. Requires the playlist-read-private scope (yes, even
// though we then filter to public ones - Spotify needs it to return the
// full set of owned/followed playlists to filter from).
router.get('/playlists', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.userId);
    const items = await getPublicPlaylists(accessToken);
    res.json({ items });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission for playlists. Log out and log in again to grant it.',
      });
    }
    console.error('playlists failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch playlists' });
  }
});

// GET /spotify/stats - follower count, following (artists) count, and top
// 5 genres for the profile page. Requires user-top-read and
// user-follow-read (see routes/auth.js) - anyone who logged in before those
// scopes were added needs to log out and back in once, same pattern as
// recently-played/playlists above.
router.get('/stats', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.userId);
    const [profile, following, topGenres] = await Promise.all([
      getMyProfile(accessToken),
      getFollowingCount(accessToken),
      getTopGenres(accessToken),
    ]);
    res.json({
      followers: profile.followers,
      following,
      topGenres,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission for followers/following/top genres. Log out and log in again to grant it.',
      });
    }
    console.error('stats failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not fetch profile stats' });
  }
});

// PUT /spotify/save-track - "Save to Liked Songs" from the song panel.
// Requires the user-library-modify scope (see routes/auth.js) - anyone who
// logged in before that scope was added needs to log out and back in once,
// same pattern as recently-played/playlists/stats above.
router.put('/save-track', async (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }

  try {
    const accessToken = await getValidAccessToken(req.userId);
    await saveTrackToLibrary(accessToken, trackId);
    res.json({ success: true });
  } catch (err) {
    const status = err.response?.status;
    const spotifyMessage = err.response?.data?.error?.message;

    if (status === 401 && spotifyMessage === 'Permissions missing') {
      return res.status(401).json({
        error: 'Your login is missing the save-to-library permission. Log out and log in again to grant it.',
      });
    }
    if (status === 403) {
      return res.status(403).json({
        error: 'Missing permission to save songs. Log out and log in again to grant it.',
      });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'This song could not be found on Spotify.' });
    }

    console.error('save-track failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not save this song' });
  }
});

module.exports = router;
