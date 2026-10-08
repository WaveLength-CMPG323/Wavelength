const { refreshAccessToken } = require('./spotifyClient');
const { saveTokens, getTokens } = require('../db/tokenStore');

// Ensures we hand back a valid, non-expired access token for a given
// user/session, refreshing it first if needed.
async function getValidAccessToken(userId) {
  const stored = await getTokens(userId);
  if (!stored) {
    throw new Error('No Spotify tokens found for this user - they need to log in first.');
  }

  const isExpired = Date.now() > stored.expiresAt - 30_000; // 30s safety buffer
  if (!isExpired) {
    return stored.accessToken;
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  const newTokens = {
    accessToken: refreshed.access_token,
    // Spotify doesn't always return a new refresh_token - keep the old one if so.
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  };
  await saveTokens(userId, newTokens);

  return newTokens.accessToken;
}

module.exports = { getValidAccessToken };
