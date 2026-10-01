const { getAllUserIds, getTokens } = require('../db/tokenStore');
const { getValidAccessToken } = require('./authHelper');
const { getCurrentlyPlaying, playTrackAt } = require('./spotifyClient');
const oceanState = require('./oceanState');
const { getActiveEffect } = require('./rewards'); // 1. Import your active effect lookup

const POLL_INTERVAL_MS = 2000; // how often we check each user's playback

async function pollAllSessions() {
  const userIds = await getAllUserIds();

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const stored = await getTokens(userId);
        const accessToken = await getValidAccessToken(userId);
        const data = await getCurrentlyPlaying(accessToken);
        
        // 2. Attach activeEffect here during the session update from poll
        oceanState.updateSessionFromPoll(userId, data, {
          spotifyUserId: stored?.spotifyUserId,
          displayName: stored?.displayName,
          profileUrl: stored?.profileUrl,
          profileImage: stored?.profileImage,
          activeEffect: getActiveEffect(userId), //Added here
        });
      } catch (err) {
        console.error(`Poll failed for session ${userId}:`, err.response?.data || err.message);
      }
    })
  );

  oceanState.pruneStalePausedSessions();
}

async function syncFollowers() {
  const pairs = oceanState.reconcileFollowsAndGetSyncList();

  await Promise.all(
    pairs.map(async ({ followerSessionId, hostSessionId }) => {
      const hostSession = oceanState.getSession(hostSessionId);
      if (!hostSession || hostSession.sunk) return;

      const followerSession = oceanState.getSession(followerSessionId);
      const alreadyOnHostTrack = followerSession && followerSession.trackId === hostSession.trackId;
      if (alreadyOnHostTrack) return;

      try {
        const accessToken = await getValidAccessToken(followerSessionId);
        const positionMs = hostSession.isPlaying
          ? Math.min(
              hostSession.progressMs + (Date.now() - hostSession.lastPolledAt),
              hostSession.durationMs || Infinity
            )
          : hostSession.progressMs;
        await playTrackAt(accessToken, hostSession.trackUri, positionMs);
      } catch (err) {
        console.error(
          `Follow-sync failed for follower ${followerSessionId}:`,
          err.response?.data || err.message
        );
      }
    })
  );
}

function startOceanPoller(io) {
  setInterval(async () => {
    await pollAllSessions();
    await syncFollowers();
    const groups = oceanState.computeGroups();
    io.emit('oceanUpdate', groups);
  }, POLL_INTERVAL_MS);
}

module.exports = { startOceanPoller };