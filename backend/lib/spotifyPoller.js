const { getAllUserIds, getTokens } = require('../db/tokenStore');
const { getValidAccessToken } = require('./authHelper');
const { getCurrentlyPlaying, playTrackAt } = require('./spotifyClient');
const oceanState = require('./oceanState');

const POLL_INTERVAL_MS = 2000; // how often we check each user's playback

async function pollAllSessions() {
  const userIds = await getAllUserIds();

  // Poll everyone in parallel - fine for a class-project-sized user
  // count. If this ever needs to scale to many more users, this should
  // be batched/staggered to respect Spotify's rate limits (this matters
  // more now that the interval is 1s instead of 4s).
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const stored = await getTokens(userId);
        const accessToken = await getValidAccessToken(userId);
        const data = await getCurrentlyPlaying(accessToken);
        oceanState.updateSessionFromPoll(userId, data, {
          spotifyUserId: stored?.spotifyUserId,
          displayName: stored?.displayName,
          profileUrl: stored?.profileUrl,
          profileImage: stored?.profileImage,
        });
      } catch (err) {
        // A single user's poll failing (expired refresh token, revoked
        // access, etc.) shouldn't break the whole ocean update.
        console.error(`Poll failed for session ${userId}:`, err.response?.data || err.message);
      }
    })
  );

  oceanState.pruneStalePausedSessions();
}

// "Follow Along": for every follower, if their followed host is now on a
// different track than they are, push the follower's own Spotify onto
// that track at the host's live position. Also handles host succession
// (promoting the next-earliest follower when a host disappears) via
// oceanState.reconcileFollowsAndGetSyncList().
async function syncFollowers() {
  const pairs = oceanState.reconcileFollowsAndGetSyncList();

  await Promise.all(
    pairs.map(async ({ followerSessionId, hostSessionId }) => {
      const hostSession = oceanState.getSession(hostSessionId);
      if (!hostSession || hostSession.sunk) return; // host not really active yet - try again next cycle

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
        // Common causes: follower has no active device, isn't Premium,
        // or their token needs re-login - none of these should crash
        // the sync loop for everyone else.
        console.error(
          `Follow-sync failed for follower ${followerSessionId}:`,
          err.response?.data || err.message
        );
      }
    })
  );
}

// Starts the polling loop and wires it up to broadcast to every
// connected browser via Socket.IO whenever state changes.
function startOceanPoller(io) {
  setInterval(async () => {
    await pollAllSessions();
    await syncFollowers();
    const groups = oceanState.computeGroups();
    io.emit('oceanUpdate', groups);
  }, POLL_INTERVAL_MS);
}

module.exports = { startOceanPoller };
