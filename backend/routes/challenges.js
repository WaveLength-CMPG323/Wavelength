const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Pool } = require('pg');
const { getValidAccessToken } = require('../lib/authHelper');
const { validateChallengeSubmission } = require('../lib/challengesValidation');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 1. GET /challenge/active - Fetch current active challenge and check user submission
router.get('/active', async (req, res) => {
  try {
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

    // Check if the user is logged in and has already submitted to this challenge
    try {
      const accessToken = await getValidAccessToken(req.sessionID);
      const userProfileRes = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const spotifyUserId = userProfileRes.data.id;

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
          cover: row.album_art
        };
      }
    } catch (sessionErr) {
      // User is not logged in yet; mySubmission remains null
    }

    res.json({
      id: activeChallenge.id,
      theme: activeChallenge.theme,
      description: activeChallenge.description,
      rewardId: activeChallenge.reward_id,
      deadline: activeChallenge.deadline,
      mySubmission
    });

  } catch (err) {
    console.error('Failed to fetch active challenge:', err);
    res.status(500).json({ error: 'Server error fetching active challenge' });
  }
});

// 2. GET /challenge/search - Server-side Spotify catalog proxy search
router.get('/search', async (req, res) => {
  const searchQuery = req.query.q;
  if (!searchQuery) {
    return res.json({ results: [] });
  }

  try {
    const accessToken = await getValidAccessToken(req.sessionID);
    
    const spotifyRes = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { q: searchQuery, type: 'track', limit: 5 }
    });

    const results = spotifyRes.data.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      cover: track.album.images?.[0]?.url || ''
    }));

    res.json({ results });
  } catch (err) {
    console.error('Spotify search proxy failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to search Spotify catalog' });
  }
});

// 3. POST /challenge/submit - Submit track with theme validation
router.post('/submit', async (req, res) => {
  const { challengeId, trackId } = req.body;
  
  if (!challengeId || !trackId) {
    return res.status(400).json({ error: 'challengeId and trackId are required' });
  }

  try {
    const accessToken = await getValidAccessToken(req.sessionID);

    // Fetch challenge theme from database
    const challengeRes = await pool.query(
      `SELECT id, theme FROM challenges WHERE id = $1 AND is_active = TRUE`,
      [challengeId]
    );

    if (challengeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Active challenge not found' });
    }
    const challenge = challengeRes.rows[0];

    // Get permanent Spotify user ID
    const userProfileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spotifyUserId = userProfileRes.data.id;

    // Fetch official track details from Spotify API
    const spotifyResponse = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const trackData = spotifyResponse.data;

    // Validate track against the challenge theme using our modular validator
    const validationResult = validateChallengeSubmission(challenge.theme, trackData);
    if (!validationResult.isValid) {
      return res.status(400).json({ error: validationResult.message });
    }

    const trackTitle = trackData.name;
    const artistName = trackData.artists.map(artist => artist.name).join(', ');
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

    res.json({ 
      success: true, 
      submission: { trackId, title: trackTitle, artist: artistName, cover: albumArtUrl } 
    });

  } catch (err) {
    console.error('Failed to process challenge submission:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not submit challenge entry' });
  }
});

module.exports = router;