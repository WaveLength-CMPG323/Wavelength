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

// spotifyUserId -> cssClass|null - whichever cosmetic reward (if any) a
// real Spotify account currently has equipped (see routes/cosmetics.js's
// POST /equip). Keyed by real account, not by session, so it survives a
// logout/login and applies no matter which browser session that account
// is currently polling from. This is ONLY the data plumbing for the
// aura - it's deliberately NOT drawn on the canvas-rendered bubbles yet
// (see useOceanCanvas.ts), that's a separate later visual feature.
const userEffects = new Map();

function setUserActiveEffect(spotifyUserId, cssClass) {
  if (!spotifyUserId) return;
  userEffects.set(spotifyUserId, cssClass ?? null);
}

function getUserActiveEffect(spotifyUserId) {
  return userEffects.get(spotifyUserId) || null;
}

const PAUSE_SINK_MS = 10_000; // sink a listener's bubble after 10s paused
// A session is only trustworthy while polls keep succeeding. If we haven't
// had a successful poll for this long (Spotify rate-limiting us, a network
// error, a token that stopped working), we no longer KNOW the person is
// still listening - so their bubble is removed instead of drifting on
// forever (the progress bar is extrapolated, so a stale session otherwise
// looks like a song that is still playing).
const STALE_SESSION_MS = 30_000;

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
    // Primary artist's genres (see spotifyPoller.js + lib/genreCache.js) -
    // may be an empty array (artist has none tagged, or the lookup
    // failed), never undefined.
    genres: spotifyData.item.genres || [],
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
    if (now - session.lastPolledAt > STALE_SESSION_MS) {
      sessions.delete(sessionId);
      continue;
    }
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
        genres: session.genres,
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
    genres: g.genres || [],
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
    activeEffectCss: getUserActiveEffect(g.hostSpotifyUserId) ?? null,
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

// Immediately drops a session from the ocean (and any Follow Along
// relationship it held as a follower), instead of waiting for it to
// naturally sink. Used on logout: the best-effort pausePlayback() call
// that runs right before logout can silently fail (no active device,
// free/non-Premium account that can't be paused via the API at all), in
// which case the account just keeps actually playing on Spotify and the
// next poll cycle would otherwise re-report it and resurrect the bubble.
// Calling this here makes "log out" reliably remove the bubble for
// everyone right away, regardless of whether the real Spotify pause
// succeeded.
function removeSession(sessionId) {
  sessions.delete(sessionId);
  follows.delete(sessionId);
}

// ---- Follow Along ----
// followerSessionId explicitly wants to keep following whatever
// hostSessionId is listening to, even across song changes.
function setFollow(followerSessionId, hostSessionId) {
  follows.set(followerSessionId, { hostSessionId, followedAt: Date.now(), lastError: null, lastSyncedTrackId: null });
}

function clearFollow(followerSessionId) {
  follows.delete(followerSessionId);
}

function isFollowing(followerSessionId) {
  return follows.has(followerSessionId);
}

// Unlike isFollowing (just a boolean), this tells the caller WHO they're
// following (plus the last sync error, if any) - used by
// GET /spotify/follow-status so the frontend can correctly restore the
// Follow Along toggle when a song panel is reopened, instead of always
// assuming "not following", AND so it can actually show the person why
// they're not moving with the host if the background sync keeps failing
// (e.g. no Spotify Premium, or no active device) - previously that failure
// only ever reached the server's own console.error, so Follow Along could
// look "on" while silently never doing anything.
function getFollow(followerSessionId) {
  return follows.get(followerSessionId) || null;
}

// Records why the last sync attempt for this follower failed, so
// GET /spotify/follow-status can report it. A no-op if they're not
// following anyone anymore (e.g. they turned it off in the meantime).
function setFollowSyncError(followerSessionId, message) {
  const entry = follows.get(followerSessionId);
  if (entry) follows.set(followerSessionId, { ...entry, lastError: message });
}

// Records the trackId we just pushed a follower's own playback onto, so
// the next poll cycle can tell "still catching up to what we last synced
// them to" apart from "they moved to something else on their own" (see
// syncFollowers() in spotifyPoller.js). A no-op if they're not following
// anyone anymore, same pattern as setFollowSyncError.
function setLastSyncedTrackId(followerSessionId, trackId) {
  const entry = follows.get(followerSessionId);
  if (entry) follows.set(followerSessionId, { ...entry, lastSyncedTrackId: trackId });
}

// Called whenever a sync attempt succeeds (or wasn't needed because the
// follower's already on the host's track) - clears any previously
// recorded error so the frontend stops showing a stale failure message.
function clearFollowSyncError(followerSessionId) {
  const entry = follows.get(followerSessionId);
  if (entry && entry.lastError) follows.set(followerSessionId, { ...entry, lastError: null });
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
        lastError: null, // fresh host - give the next sync attempt a clean slate
        lastSyncedTrackId: null, // new host relationship - treat like a fresh follow for sync purposes
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
  removeSession,
  setFollow,
  clearFollow,
  isFollowing,
  getFollow,
  setFollowSyncError,
  clearFollowSyncError,
  setLastSyncedTrackId,
  reconcileFollowsAndGetSyncList,
  setUserActiveEffect,
  getUserActiveEffect,
};
