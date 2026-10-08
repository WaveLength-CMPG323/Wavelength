const express = require('express');
const router = express.Router();

// Shared singleton (see db/pool.js and the comment in routes/challenges.js)
// instead of this module opening its own `new Pool(...)`.
const pool = require('../db/pool');
const { getTokens } = require('../db/tokenStore');
const oceanState = require('../lib/oceanState');

function requirePool(res) {
  if (pool) return true;
  res.status(503).json({ error: 'Cosmetics require DATABASE_URL to be set' });
  return false;
}

// GET /cosmetics/inventory - Fetch the caller's unlocked cosmetics and
// equip status.
router.get('/inventory', async (req, res) => {
  if (!requirePool(res)) return;
  if (!req.userId) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  try {
    const stored = await getTokens(req.userId);
    const spotifyUserId = stored?.spotifyUserId;
    if (!spotifyUserId) {
      return res.status(401).json({ error: 'You need to log in first' });
    }

    // Fetch rewards joined with user unlocked status
    const result = await pool.query(
      `SELECT r.reward_id, r.name, r.description, r.effect_type, r.css_class,
              COALESCE(uc.is_equipped, FALSE) AS is_equipped,
              CASE WHEN uc.reward_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_unlocked
       FROM rewards r
       LEFT JOIN user_cosmetics uc ON r.reward_id = uc.reward_id AND uc.spotify_user_id = $1
       -- Rewards are limited-time: show what the caller owns, plus this
       -- week's border (so it can be previewed). Past ones they missed are gone.
       WHERE uc.reward_id IS NOT NULL
          OR r.reward_id IN (SELECT reward_id FROM challenges WHERE is_active = TRUE)`,
      [spotifyUserId]
    );

    res.json({ cosmetics: result.rows });
  } catch (err) {
    console.error('Failed to fetch cosmetics inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST /cosmetics/equip { rewardId, isEquipped } - Equip or unequip a
// specific reward, then push the change into oceanState (so live ocean
// sessions can carry `activeEffectCss`) and broadcast it over Socket.IO.
router.post('/equip', async (req, res) => {
  if (!requirePool(res)) return;
  if (!req.userId) {
    return res.status(401).json({ error: 'You need to log in first' });
  }

  const { rewardId, isEquipped } = req.body || {};
  if (!rewardId) {
    return res.status(400).json({ error: 'rewardId is required' });
  }

  try {
    const stored = await getTokens(req.userId);
    const spotifyUserId = stored?.spotifyUserId;
    if (!spotifyUserId) {
      return res.status(401).json({ error: 'You need to log in first' });
    }

    if (isEquipped) {
      // Unequip all other cosmetics for this user first
      await pool.query(`UPDATE user_cosmetics SET is_equipped = FALSE WHERE spotify_user_id = $1`, [
        spotifyUserId,
      ]);
      // Then equip the target one
      await pool.query(
        `UPDATE user_cosmetics SET is_equipped = TRUE WHERE spotify_user_id = $1 AND reward_id = $2`,
        [spotifyUserId, rewardId]
      );
    } else {
      await pool.query(
        `UPDATE user_cosmetics SET is_equipped = FALSE WHERE spotify_user_id = $1 AND reward_id = $2`,
        [spotifyUserId, rewardId]
      );
    }

    // Update oceanState so live sessions reflect the active effect immediately
    const activeCss = isEquipped
      ? (await pool.query(`SELECT css_class FROM rewards WHERE reward_id = $1`, [rewardId])).rows[0]?.css_class ?? null
      : null;
    oceanState.setUserActiveEffect(spotifyUserId, activeCss);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_cosmetic_changed', { spotifyUserId, rewardId, isEquipped: !!isEquipped, cssClass: activeCss });
    }

    res.json({ success: true, rewardId, isEquipped: !!isEquipped });
  } catch (err) {
    console.error('Failed to update equipped cosmetic:', err);
    res.status(500).json({ error: 'Could not update equipment state' });
  }
});

module.exports = router;
