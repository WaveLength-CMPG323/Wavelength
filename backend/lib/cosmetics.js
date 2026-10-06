const challengeStore = require('../db/challengeStore');
const { getCosmeticById, publicCosmetic } = require('./challenges');

// The cosmetic this person currently has switched on, ready to send to the
// client - or null. Never throws: a cosmetic is decoration, so if the
// lookup fails (DB hiccup, a cosmetic removed from the catalog) callers
// like /auth/me should carry on without it instead of breaking login.
async function getActiveCosmeticFor(spotifyUserId) {
  if (!spotifyUserId) return null;
  try {
    const id = await challengeStore.getActiveCosmeticId(spotifyUserId);
    return id ? publicCosmetic(getCosmeticById(id)) : null;
  } catch (err) {
    console.error('Could not load active cosmetic:', err.message);
    return null;
  }
}

// The set of cosmetic ids this person has earned (one per completed
// challenge). Rewards are derived from completions rather than stored
// separately, so the two can never drift out of sync.
async function getOwnedCosmeticIds(spotifyUserId) {
  const completions = await challengeStore.getCompletions(spotifyUserId);
  return new Set(completions.map((c) => c.cosmeticId));
}

module.exports = { getActiveCosmeticFor, getOwnedCosmeticIds };
