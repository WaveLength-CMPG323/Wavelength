// Which border (the css_class of the reward, e.g. 'skeletons') each person
// currently has equipped, so every list that shows a person's picture can
// draw it with their border - chats, group members, challenge entries,
// profiles. One query for the whole batch.
//
// Returns an empty result when there's no database or the cosmetics tables
// aren't there yet: a missing border should never break a chat list.

const pool = require('../db/pool');

async function getEquippedBorders(spotifyUserIds) {
  const ids = [...new Set((spotifyUserIds || []).filter(Boolean))];
  if (!pool || ids.length === 0) return new Map();
  try {
    const result = await pool.query(
      `SELECT uc.spotify_user_id, r.css_class
       FROM user_cosmetics uc
       JOIN rewards r ON r.reward_id = uc.reward_id
       WHERE uc.is_equipped = TRUE AND uc.spotify_user_id = ANY($1::text[])`,
      [ids]
    );
    return new Map(result.rows.map((row) => [row.spotify_user_id, row.css_class]));
  } catch (error) {
    console.error('Could not load equipped borders:', error.message);
    return new Map();
  }
}

// Everyone's equipped border, used once at boot to refill the ocean's
// in-memory copy (see lib/oceanState.js) after a restart.
async function getAllEquippedBorders() {
  if (!pool) return [];
  try {
    const result = await pool.query(
      `SELECT uc.spotify_user_id, r.css_class
       FROM user_cosmetics uc
       JOIN rewards r ON r.reward_id = uc.reward_id
       WHERE uc.is_equipped = TRUE`
    );
    return result.rows;
  } catch (error) {
    console.error('Could not load equipped borders at startup:', error.message);
    return [];
  }
}

module.exports = { getEquippedBorders, getAllEquippedBorders };
