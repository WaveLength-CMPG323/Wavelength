const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { exchangeCodeForTokens, getMyProfile } = require('../lib/spotifyClient');
const { saveTokens, getTokens, deleteTokens } = require('../db/tokenStore');
const { generateUserId } = require('../lib/identity');
const { isRateLimitError, isUserCapError, noteRateLimit } = require('../lib/spotifyQuota');
const oceanState = require('../lib/oceanState');

const { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, FRONTEND_URL } = process.env;

// Matches the check in server.js - the 'state' cookie below is only ever
// read back on a same-domain redirect from Spotify, but a real HTTPS
// deployment still needs Secure set (browsers are increasingly strict
// about this), while local http:// dev must NOT set it or the cookie
// won't be stored at all.
const NEEDS_SECURE_COOKIES = (FRONTEND_URL || '').startsWith('https://');

// user-top-read (top artists, for the profile page's top-genres derivation)
// and user-follow-read (followed-artists count) were added alongside the
// existing user-read-recently-played/playlist-read-private scopes - same
// deal as those: anyone who logged in before this change needs to log out
// and back in once for /spotify/stats to actually work.
//
// user-library-modify was added for the song panel's "Save to Liked Songs"
// button (PUT /v1/me/tracks) - same deal again: anyone already logged in
// before this change needs to log out and back in once to grant it, or
// that button will fail with a permissions error until they do.
const SCOPES =
  'user-read-currently-playing user-read-playback-state user-modify-playback-state ' +
  'user-read-email user-read-recently-played playlist-read-private user-top-read user-follow-read ' +
  'user-library-modify';

// GET /auth/login - frontend sends the user here to start the flow
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('spotify_auth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: NEEDS_SECURE_COOKIES,
  });

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SCOPES,
    state,
    // Without this, Spotify silently skips the consent screen for anyone
    // who already authorized this app before (even when the scope list
    // has grown since then) and just re-issues a token with whatever
    // scopes they originally granted - so a "log out and log back in" to
    // pick up a newly added scope (user-top-read, user-library-modify,
    // etc.) would appear to do nothing, over and over, because Spotify
    // never actually re-prompted. Forcing the dialog every time makes
    // every login/re-login an explicit, current consent for the full
    // SCOPES list above.
    show_dialog: 'true',
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// GET /auth/callback - Spotify redirects the browser back here
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies?.spotify_auth_state;

  // The frontend's login screen lives at /login (not a separate
  // /login-error route) and reads ?error= to show a message - see
  // src/features/auth/LoginPage.tsx.
  if (error) {
    return res.redirect(`${FRONTEND_URL}/login?error=${error}`);
  }
  if (!state || state !== storedState) {
    return res.redirect(`${FRONTEND_URL}/login?error=state_mismatch`);
  }

  try {
    const { access_token, refresh_token, expires_in } = await exchangeCodeForTokens(code);

    // A brand new opaque id for this login - NOT read from a cookie (see
    // lib/identity.js for why: an identity cookie here would be a
    // third-party cookie, since the frontend and backend are on different
    // *.onrender.com subdomains, and those get blocked by a growing share
    // of browsers regardless of how it's configured). This id is handed
    // back to the frontend once, below, as a bearer token it stores itself
    // and attaches to every future request - so it works the same in every
    // browser, with no dependence on cookie policy at all.
    const userId = generateUserId();

    // The real Spotify account id - used to tell "the same person in two
    // browser tabs" apart from "two different people" for listener
    // counts, and to show/link the host's name in the ocean panel.
    const profile = await getMyProfile(access_token);

    await saveTokens(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      spotifyUserId: profile.spotifyUserId,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      email: profile.email,
      profileImage: profile.profileImage,
    });

    res.clearCookie('spotify_auth_state');
    // The Ocean page is the frontend's root route ("/"), not "/ocean" -
    // see src/App.tsx. The new bearer token rides along in the URL hash
    // (never sent to any server, including this one, on later requests -
    // unlike a query string) so the frontend can pick it up, save it to
    // localStorage, and strip it from the address bar. See
    // src/data/AuthContext.tsx for the other half of this handoff.
    res.redirect(`${FRONTEND_URL}/#wl_token=${encodeURIComponent(userId)}`);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    // Spotify refusing because of a limit (rate limit, or a Development Mode
    // app that's out of allowed users) gets its own message on the login page.
    if (isRateLimitError(err)) noteRateLimit(err, req.app.get('io'));
    const quota = isRateLimitError(err) || isUserCapError(err);
    res.redirect(`${FRONTEND_URL}/login?error=${quota ? 'quota_reached' : 'token_exchange_failed'}`);
  }
});

// GET /auth/me - lets the frontend ask "is this browser logged in?" on
// load (and after the OAuth redirect lands back on the Ocean page), and
// get the real Spotify profile info to display, without exposing tokens.
router.get('/me', async (req, res) => {
  try {
    const stored = await getTokens(req.userId);
    if (!stored) {
      return res.json({ loggedIn: false, profile: null });
    }
    res.json({
      loggedIn: true,
      profile: {
        spotifyUserId: stored.spotifyUserId,
        displayName: stored.displayName,
        profileUrl: stored.profileUrl,
        email: stored.email ?? null,
        profileImage: stored.profileImage ?? null,
      },
    });
  } catch (err) {
    console.error('auth/me failed:', err.message);
    res.status(500).json({ loggedIn: false, profile: null });
  }
});

// GET /auth/logout - called by the frontend via fetch (not a page nav) so
// it can be triggered from the "Log out" button without leaving the app.
// There's no server-side SESSION to clear (see lib/identity.js) - the
// frontend deletes its own stored bearer token right after this call
// resolves (see logout() in src/lib/api.ts), which is what actually makes
// /auth/me start reporting logged-out again. This doesn't revoke the
// Spotify token itself - Spotify has no simple client revoke endpoint.
//
// It DOES, however, immediately drop this account from the ocean
// (oceanState.removeSession) and delete its stored tokens so the
// background poller (spotifyPoller.js) never picks it up again. Both are
// needed: without removeSession, the bubble would linger for up to 10s
// (PAUSE_SINK_MS) even in the best case; without deleteTokens, an account
// whose best-effort pause-on-logout call failed (no active device, or a
// free/non-Premium account that Spotify's API won't let us pause at all)
// would keep actually playing, and the very next 2s poll would just
// resurrect the bubble that removeSession had cleared.
router.get('/logout', async (req, res) => {
  oceanState.removeSession(req.userId);
  try {
    await deleteTokens(req.userId);
  } catch (err) {
    console.error('Failed to delete tokens on logout:', err.message);
  }
  res.json({ success: true });
});

module.exports = router;
