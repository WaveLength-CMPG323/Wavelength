const express = require('express');
const router = express.Router();
const axios = require('axios');

// Shared singleton (see db/pool.js) instead of this module opening its own
// `new Pool(...)` - keeps the total number of connections to the hosted
// Postgres instance (Supabase caps this) to one pool for the whole process.
// `null` when DATABASE_URL isn't set - every query below is gated behind
// a pool check so local dev without Postgres gets a clear error instead
// of a crash, matching this backend's useMemoryStore convention (there's
// no sensible in-memory equivalent for challenge/reward persistence, so
// this feature simply requires Postgres to actually work).
const pool = require('../db/pool');
const crypto = require('crypto');
const { getTokens, getTokensBySpotifyUserId } = require('../db/tokenStore');
const { getValidAccessToken } = require('../lib/authHelper');
const { playTrackAt } = require('../lib/spotifyClient');
const { validateChallengeSubmission } = require('../lib/challengesValidation');
const { rotateChallenges, ensureActiveChallenge } = require('../lib/challengeRotation');
const { getEquippedBorders } = require('../lib/equippedBorders');

function requirePool(res) {
  if (pool) return true;
  res.status(503).json({ error: 'Weekly Challenges require DATABASE_URL to be set' });
  return false;
}

// 1. GET /challenges/active - Fetch current active challenge and (if the
// caller is logged in) their own submission to it. Works for guests too -
// just skips the submission lookup instead of 401ing.
router.get('/active', async (req, res) => {
  if (!requirePool(res)) return;

  try {
    // If the live challenge has expired (or none exists yet), roll over to
    // the next one before answering - the background scheduler normally has
    // already, this just covers a server that was asleep past a deadline.
    await ensureActiveChallenge(req.app.get('io'));

    const challengeResult = await pool.query(
      `SELECT id, theme, description, reward_id, deadline, is_active, created_at
       FROM challenges
       WHERE is_active = TRUE
       LIMIT 1`
    );

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    const activeChallenge = challengeResult.rows[0];
    let mySubmission = null;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = $1`,
      [activeChallenge.id]
    );
    const participantCount = parseInt(countResult.rows[0].count, 10);

    // Only logged-in callers have a submission to look up - this is just a
    // stored-token lookup (same as chatRequests.js's getMySpotifyIdentity),
    // not a live Spotify call.
    const stored = await getTokens(req.userId);
    const spotifyUserId = stored?.spotifyUserId;

    if (spotifyUserId) {
      const subResult = await pool.query(
        `SELECT track_id, track_title, artist, album_art
         FROM challenge_submissions
         WHERE challenge_id = $1 AND spotify_user_id = $2`,
        [activeChallenge.id, spotifyUserId]
      );

      if (subResult.rows.length > 0) {
        const row = subResult.rows[0];
        mySubmission = {
          trackId: row.track_id,
          title: row.track_title,
          artist: row.artist,
          cover: row.album_art,
        };
      }
    }

    res.json({
      id: activeChallenge.id,
      theme: activeChallenge.theme,
      description: activeChallenge.description,
      rewardId: activeChallenge.reward_id,
      deadline: activeChallenge.deadline,
      // When this challenge began - with `deadline`, this is the window the
      // frontend's countdown/progress bar runs across.
      startedAt: activeChallenge.created_at,
      mySubmission,
      participantCount,
    });
  } catch (err) {
    console.error('Failed to fetch active challenge:', err);
    res.status(500).json({ error: 'Server error fetching active challenge' });
  }
});

// GET /challenges/:id/entries - everyone's submission to one challenge, as
// a display list (newest first). Needs a login (it shows other people's
// names). Names are nickname-first, then Spotify display name, and never a
// raw account id.
router.get('/:id/entries', async (req, res) => {
  if (!requirePool(res)) return;

  const challengeId = parseInt(req.params.id, 10);
  if (Number.isNaN(challengeId)) {
    return res.status(400).json({ error: 'Invalid challenge id' });
  }

  try {
    const stored = await getTokens(req.userId);
    const mySpotifyUserId = stored?.spotifyUserId;
    if (!mySpotifyUserId) {
      return res.status(401).json({ error: 'You need to log in first' });
    }

    const result = await pool.query(
      `SELECT spotify_user_id, track_id, track_title, artist, album_art, created_at
       FROM challenge_submissions
       WHERE challenge_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [challengeId]
    );

    const borders = await getEquippedBorders(result.rows.map((row) => row.spotify_user_id));
    const entries = await Promise.all(
      result.rows.map(async (row) => {
        const profile = await getTokensBySpotifyUserId(row.spotify_user_id);
        return {
          spotifyUserId: row.spotify_user_id,
          displayName: profile?.nickname || profile?.displayName || 'A Wavelength listener',
          profileImage: profile?.profileImage || null,
          border: borders.get(row.spotify_user_id) ?? null,
          trackId: row.track_id,
          title: row.track_title,
          artist: row.artist,
          cover: row.album_art,
          submittedAt: row.created_at,
          isMine: row.spotify_user_id === mySpotifyUserId,
        };
      })
    );

    res.json({ entries });
  } catch (err) {
    console.error('Failed to fetch challenge entries:', err);
    res.status(500).json({ error: 'Could not load challenge entries' });
  }
});

// POST /challenges/admin/rotate - end the current challenge right now and
// start the next one (everyone becomes un-joined, same as a normal
// rollover). For whoever runs the app, not players: it needs the secret in
// the CHALLENGE_ADMIN_KEY environment variable, sent as an x-admin-key
// header, and is switched off entirely when that variable isn't set.
router.post('/admin/rotate', async (req, res) => {
  if (!requirePool(res)) return;

  const expected = process.env.CHALLENGE_ADMIN_KEY;
  if (!expected) {
    return res.status(404).json({ error: 'Not found' });
  }
  const provided = String(req.get('x-admin-key') || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }

  try {
    const result = await rotateChallenges({ io: req.app.get('io'), force: true });
    res.json({
      rotated: result.rotated,
      endedChallengeIds: result.endedChallengeIds,
      challenge: result.challenge
        ? { id: result.challenge.id, theme: result.challenge.theme, deadline: result.challenge.deadline }
        : null,
    });
  } catch (err) {
    console.error('Admin challenge rotation failed:', err);
    res.status(500).json({ error: 'Could not rotate challenges' });
  }
});

// 2. GET /challenges/search?q=... - Server-side Spotify catalog proxy
// search. Needs a real access token to call Spotify's own search API, so
// the caller must be logged in.
router.get('/search', async (req, res) => {
  const searchQuery = req.query.q;
  if (!searchQuery) {
    return res.json({ results: [] });
  }

  if (!req.userId) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  try {
    const accessToken = await getValidAccessToken(req.userId);

    const spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { q: searchQuery, type: 'track', limit: 5 },
    });

    const results = spotifyRes.data.tracks.items.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      cover: track.album.images?.[0]?.url || '',
    }));

    res.json({ results });
  } catch (err) {
    console.error('Spotify search proxy failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to search Spotify catalog' });
  }
});

// 3. POST /challenges/submit { challengeId, trackId } - Submit a track,
// validated against the active challenge's theme.
router.post('/submit', async (req, res) => {
  if (!requirePool(res)) return;

  const { challengeId, trackId } = req.body || {};
  if (!challengeId || !trackId) {
    return res.status(400).json({ error: 'challengeId and trackId are required' });
  }

  if (!req.userId) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  try {
    const stored = await getTokens(req.userId);
    const spotifyUserId = stored?.spotifyUserId;
    if (!spotifyUserId) {
      return res.status(401).json({ error: 'You need to log in first' });
    }

    const accessToken = await getValidAccessToken(req.userId);

    // Fetch challenge theme from database
    const challengeRes = await pool.query(
      `SELECT id, theme, reward_id FROM challenges WHERE id = $1 AND is_active = TRUE`,
      [challengeId]
    );

    if (challengeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Active challenge not found' });
    }
    const challenge = challengeRes.rows[0];

    // Fetch official track details from Spotify API
    const spotifyResponse = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const trackData = spotifyResponse.data;

    // Validate track against the challenge theme using our modular validator
    const validationResult = validateChallengeSubmission(challenge.theme, trackData);
    if (!validationResult.isValid) {
      return res.status(400).json({ error: validationResult.message });
    }

    const trackTitle = trackData.name;
    const artistName = trackData.artists.map((artist) => artist.name).join(', ');
    const albumArtUrl = trackData.album.images?.[0]?.url || null;

    // Save or update submission in Supabase
    await pool.query(
      `INSERT INTO challenge_submissions (challenge_id, spotify_user_id, track_id, track_title, artist, album_art)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (challenge_id, spotify_user_id)
       DO UPDATE SET track_id = $3, track_title = $4, artist = $5, album_art = $6`,
      [challengeId, spotifyUserId, trackId, trackTitle, artistName, albumArtUrl]
    );

    if (challenge.reward_id) {
      await pool.query(
        `INSERT INTO user_cosmetics (spotify_user_id, reward_id, is_equipped)
         VALUES ($1, $2, FALSE)
         ON CONFLICT (spotify_user_id, reward_id) DO NOTHING`,
        [spotifyUserId, challenge.reward_id]
      );
    }

    // Re-count and broadcast the live participant count so every open
    // WeeklyChallengePanel updates without needing to reopen it (see
    // GET /active above for the initial count on load).
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = $1`,
      [challengeId]
    );
    const participantCount = parseInt(countResult.rows[0].count, 10);
    const io = req.app.get('io');
    if (io) {
      io.emit('challenge:update', { challengeId, participantCount });
    }

    // Actually start this track playing on the submitter's own Spotify
    // right now (same /me/player/play call Follow Along uses to jump a
    // listener onto a host's track) - this is what makes the submitted
    // song show up in the ocean at all: oceanState only ever reflects
    // each session's live currently-playing poll, it has no idea what got
    // submitted to a challenge otherwise. Best-effort: the submission
    // itself is already saved above, so a playback failure (no Premium,
    // no active device) shouldn't make the whole request fail - it just
    // means the entry is recorded but nothing starts playing anywhere.
    let playbackStarted = false;
    let playbackError = null;
    try {
      await playTrackAt(accessToken, trackData.uri, 0);
      playbackStarted = true;
    } catch (playErr) {
      const status = playErr.response?.status;
      const spotifyMessage = playErr.response?.data?.error?.message;
      if (status === 401 && spotifyMessage === 'Permissions missing') {
        playbackError = 'Your login is missing the playback-control permission. Log out and log in again to grant it.';
      } else if (status === 403) {
        playbackError = 'Starting playback requires Spotify Premium - your entry was saved, but the track won’t auto-play.';
      } else if (status === 404) {
        playbackError = 'No active Spotify device found - open Spotify on a device, then play the track yourself to show up in the ocean.';
      } else {
        playbackError = 'Entry saved, but could not start playback on Spotify.';
      }
      console.error('Could not start challenge-entry playback:', playErr.response?.data || playErr.message);
    }

    res.json({
      success: true,
      submission: { trackId, title: trackTitle, artist: artistName, cover: albumArtUrl },
      playbackStarted,
      playbackError,
    });
  } catch (err) {
    console.error('Failed to process challenge submission:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not submit challenge entry' });
  }
});

module.exports = router;
