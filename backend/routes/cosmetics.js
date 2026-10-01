const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Pool } = require('pg');
const { getValidAccessToken } = require('../lib/authHelper');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /cosmetics/inventory - Fetch user unlocked cosmetics and equipment status
router.get('/inventory', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.sessionID);
    const userProfileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spotifyUserId = userProfileRes.data.id;

    // Fetch rewards joined with user unlocked status
    const result = await pool.query(
      `SELECT r.reward_id, r.name, r.description, r.effect_type, r.css_class, 
              COALESCE(uc.is_equipped, FALSE) AS is_equipped,
              CASE WHEN uc.reward_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_unlocked
       FROM rewards r
       LEFT JOIN user_cosmetics uc ON r.reward_id = uc.reward_id AND uc.spotify_user_id = $1`,
      [spotifyUserId]
    );

    res.json({ cosmetics: result.rows });
  } catch (err) {
    console.error('Failed to fetch cosmetics inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /cosmetics/equip - Equip or unequip a specific reward
router.post('/equip', async (req, res) => {
  const { rewardId, isEquipped } = req.body;

  if (!rewardId) {
    return res.status(400).json({ error: 'rewardId is required' });
  }

  try {
    const accessToken = await getValidAccessToken(req.sessionID);
    const userProfileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spotifyUserId = userProfileRes.data.id;

    // Verify the user actually owns this reward
    const ownershipCheck = await pool.query(
      `SELECT 1 FROM user_cosmetics WHERE spotify_user_id = $1 AND reward_id = $2`,
      [spotifyUserId, rewardId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You have not unlocked this cosmetic reward yet' });
    }

    if (isEquipped) {
      await pool.query(
        `UPDATE user_cosmetics SET is_equipped = FALSE WHERE spotify_user_id = $1`,
        [spotifyUserId]
      );
    }

    // Update the target cosmetic's equipment state
    await pool.query(
      `UPDATE user_cosmetics SET is_equipped = $1 WHERE spotify_user_id = $2 AND reward_id = $3`,
      [isEquipped, spotifyUserId, rewardId]
    );

    // Broadcast change via Socket.io if io instance is attached to app
    const io = req.app.get('io');
    if (io) {
      io.emit('user_cosmetic_changed', {
        spotifyUserId,
        rewardId,
        isEquipped
      });
    }

    res.json({ success: true, rewardId, isEquipped });
  } catch (err) {
    console.error('Failed to update equipped cosmetic:', err);
    res.status(500).json({ error: 'Could not update equipment state' });
  }
});

module.exports = router;