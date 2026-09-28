// Tracks what every logged-in user is currently listening to, and groups
// them by track so the ocean page shows ONE bubble per song with a
// listener count, rather than duplicate bubbles for the same song.
//
// This is all in-memory and rebuilt from Spotify polls every second -
// it is NOT persisted anywhere, by design (it's live, ephemeral state,
// not something that needs to survive a restart).

// sessionId -> {
//   trackId, trackUri, trackName, artist, albumArt,
//   isPlaying, progressMs, durationMs,
//   lastPolledAt,       // Date.now() at last successful poll
//   pausedSince,        // Date.now() when isPlaying first became false, or null
//   sunk,               // true once this session's bubble should be gone
//   firstSeenAt,        // Date.now() when this session started listening to this trackId
//   spotifyUserId, displayName, profileUrl, profileImage,  // the REAL Spotify account behind this session
// }
const sessions = new Map();

// followerSessionId -> { hostSessionId, followedAt }
// A separate, explicit "keep following this person even if they change
// songs" relationship - distinct from just happening to listen to the
// same track as someone else.
const follows = new Map();

const PAUSE_SINK_MS = 10_000; // sink a listener's bubble after 10s paused

// Called once per session, per poll cycle, with the raw Spotify
// currently-playing response (or null if nothing/no device) plus the
// real Spotify account info behind this session.
function updateSessionFromPoll(sessionId, spotifyData, accountInfo) {
  if (!spotifyData || !spotifyData.item) {
    // Nothing playing / no active device - this listener sinks immediately.
    sessions.delete(sessionId);
    return;
  }

  const trackId = spotifyData.item.id;
  const existing = sessions.get(sessionId);
  const isPlaying = !!spotifyData.is_playing;

  // Fix for the "keeps refreshing" bug: once a session has been marked
  // sunk for THIS track while still paused, don't let a later poll (which
  // still reports the same paused track - Spotify keeps reporting a
  // paused track for a while) resurrect it and restart the 10s countdown
  // from scratch. Only playing again, or switching tracks, clears it.
  if (existing && existing.trackId === trackId && existing.sunk && !isPlaying) {
    sessions.set(sessionId, { ...existing, lastPolledAt: Date.now() });
    return;
  }

  let pausedSince = null;
  if (!isPlaying) {
    pausedSince =
      existing && existing.trackId === trackId && existing.pausedSince
        ? existing.pausedSince
        : Date.now();
  }

  sessions.set(sessionId, {
    trackId,
    trackUri: spotifyData.item.uri,
    trackName: spotifyData.item.name,
    artist: spotifyData.item.artists?.map((a) => a.name).join(', '),
    albumArt: spotifyData.item.album?.images?.[0]?.url,
    isPlaying,
    progressMs: spotifyData.progress_ms,
    durationMs: spotifyData.item.duration_ms,
    lastPolledAt: Date.now(),
    pausedSince,
    sunk: false,
    firstSeenAt: existing?.trackId === trackId ? existing.firstSeenAt : Date.now(),
    spotifyUserId: accountInfo?.spotifyUserId,
    displayName: accountInfo?.displayName,
    profileUrl: accountInfo?.profileUrl,
    profileImage: accountInfo?.profileImage,
  });
}

// Marks (doesn't delete) any session that's been paused too long, so it
// stops showing up in groups but can't immediately reappear from a stale
// poll still reporting the same paused track (see the guard above).
function pruneStalePausedSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (!session.sunk && session.pausedSince && now - session.pausedSince > PAUSE_SINK_MS) {
      sessions.set(sessionId, { ...session, sunk: true });
    }
  }
}

// Groups all current (non-sunk) sessions by trackId AND by real Spotify
// account, so the ocean shows one bubble per song with an accurate
// listener count - one person with several devices/tabs open on the same
// account only counts once.
function computeGroups() {
  const groups = new Map(); // trackId -> group

  for (const [sessionId, session] of sessions.entries()) {
    if (session.sunk) continue;

    let group = groups.get(session.trackId);
    if (!group) {
      group = {
        trackId: session.trackId,
        trackUri: session.trackUri,
        trackName: session.trackName,
        artist: session.artist,
        albumArt: session.albumArt,
        isPlaying: session.isPlaying,
        progressMs: session.progressMs,
        durationMs: session.durationMs,
        lastPolledAt: session.lastPolledAt,
        firstSeenAt: session.firstSeenAt,
        hostSessionId: sessionId, // the earliest listener anchors position/host info
        hostDisplayName: session.displayName,
        hostProfileUrl: session.profileUrl,
        hostSpotifyUserId: session.spotifyUserId,
        hostProfileImage: session.profileImage,
        _accountIds: new Set(), // internal only - not sent to the client as-is
      };
      groups.set(session.trackId, group);
    }

    group._accountIds.add(session.spotifyUserId || sessionId); // fall back to sessionId if profile fetch ever failed

    // Keep whichever session has been listening to this track the
    // longest as the "host" - anchoring position, playing state, and
    // whose name/profile is shown.
    if (session.firstSeenAt < group.firstSeenAt) {
      group.isPlaying = session.isPlaying;
      group.progressMs = session.progressMs;
      group.durationMs = session.durationMs;
      group.lastPolledAt = session.lastPolledAt;
      group.firstSeenAt = session.firstSeenAt;
      group.hostSessionId = sessionId;
      group.hostDisplayName = session.displayName;
      group.hostProfileUrl = session.profileUrl;
      group.hostSpotifyUserId = session.spotifyUserId;
      group.hostProfileImage = session.profileImage;
    }
  }

  return Array.from(groups.values()).map((g) => ({
    trackId: g.trackId,
    trackUri: g.trackUri,
    trackName: g.trackName,
    artist: g.artist,
    albumArt: g.albumArt,
    isPlaying: g.isPlaying,
    progressMs: g.progressMs,
    durationMs: g.durationMs,
    lastPolledAt: g.lastPolledAt,
    firstSeenAt: g.firstSeenAt,
    hostSessionId: g.hostSessionId,
    hostDisplayName: g.hostDisplayName,
    hostProfileUrl: g.hostProfileUrl,
    hostSpotifyUserId: g.hostSpotifyUserId,
    hostProfileImage: g.hostProfileImage,
    listenerCount: g._accountIds.size,
  }));
}

// Extrapolates a group's live position right now, accounting for the
// time elapsed since its anchor session was last polled. Used when
// someone clicks to join a track, so they start close to the real
// current position rather than wherever it was last poll cycle.
function getLiveProgressMs(group) {
  if (!group.isPlaying) return group.progressMs;
  const elapsed = Date.now() - group.lastPolledAt;
  return Math.min(group.progressMs + elapsed, group.durationMs || Infinity);
}

function isSessionInGroup(sessionId, trackId) {
  const session = sessions.get(sessionId);
  return !!session && !session.sunk && session.trackId === trackId;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

// ---- Follow Along ----
// followerSessionId explicitly wants to keep following whatever
// hostSessionId is listening to, even across song changes.
function setFollow(followerSessionId, hostSessionId) {
  follows.set(followerSessionId, { hostSessionId, followedAt: Date.now() });
}

function clearFollow(followerSessionId) {
  follows.delete(followerSessionId);
}

function isFollowing(followerSessionId) {
  return follows.has(followerSessionId);
}

// Unlike isFollowing (just a boolean), this tells the caller WHO they're
// following - used by GET /spotify/follow-status so the frontend can
// correctly restore the Follow Along toggle when a song panel is reopened,
// instead of always assuming "not following".
function getFollow(followerSessionId) {
  return follows.get(followerSessionId) || null;
}

// Runs host succession: if a followed host's session is gone (sunk or
// stopped entirely), promote the earliest-followed remaining follower of
// that host to be the new host, and repoint everyone else at them.
// Returns the list of {followerSessionId, hostSessionId} pairs that still
// need their playback synced to their (possibly new) host this cycle.
function reconcileFollowsAndGetSyncList() {
  // Group current followers by the host they're following.
  const byHost = new Map(); // hostSessionId -> [{followerSessionId, followedAt}]
  for (const [followerSessionId, { hostSessionId, followedAt }] of follows.entries()) {
    if (!byHost.has(hostSessionId)) byHost.set(hostSessionId, []);
    byHost.get(hostSessionId).push({ followerSessionId, followedAt });
  }

  for (const [hostSessionId, followers] of byHost.entries()) {
    const hostSession = sessions.get(hostSessionId);
    const hostGone = !hostSession || hostSession.sunk;
    if (!hostGone) continue;

    // Promote the earliest follower still actually listening to something.
    followers.sort((a, b) => a.followedAt - b.followedAt);
    const promoted = followers.find((f) => {
      const s = sessions.get(f.followerSessionId);
      return s && !s.sunk;
    });

    if (!promoted) continue; // nobody left to promote - relationships just go stale until someone plays something

    follows.delete(promoted.followerSessionId); // they're the host now, not a follower
    for (const f of followers) {
      if (f.followerSessionId === promoted.followerSessionId) continue;
      follows.set(f.followerSessionId, {
        hostSessionId: promoted.followerSessionId,
        followedAt: f.followedAt,
      });
    }
  }

  return Array.from(follows.entries()).map(([followerSessionId, { hostSessionId }]) => ({
    followerSessionId,
    hostSessionId,
  }));
}

module.exports = {
  updateSessionFromPoll,
  pruneStalePausedSessions,
  computeGroups,
  getLiveProgressMs,
  isSessionInGroup,
  getSession,
  setFollow,
  clearFollow,
  isFollowing,
  getFollow,
  reconcileFollowsAndGetSyncList,
};
