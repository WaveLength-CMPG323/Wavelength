const express = require('express');
const router = express.Router();

const { getTokens } = require('../db/tokenStore');
const challengeStore = require('../db/challengeStore');
const { getValidAccessToken } = require('../lib/authHelper');
const { getCurrentlyPlaying, getRecentlyPlayed } = require('../lib/spotifyClient');
const { getWeek, getCosmeticById, publicCosmetic } = require('../lib/challenges');
const { getOwnedCosmeticIds } = require('../lib/cosmetics');

// Challenges belong to real Spotify accounts, not browser sessions - a
// reward has to survive logging out and coming back on another device. So,
// like routes/chatRequests.js, resolve the session to its Spotify account.
async function getIdentity(req) {
  const stored = await getTokens(req.sessionID);
  return stored?.spotifyUserId ? { spotifyUserId: stored.spotifyUserId } : null;
}

function publicCompletion(c) {
  if (!c) return null;
  return {
    weekKey: c.weekKey,
    challengeId: c.challengeId,
    theme: c.theme,
    completedAt: c.completedAt,
    track: c.track,
  };
}

function sendError(res, err, fallback) {
  const status = err.response?.status;
  if (status === 403) {
    return res.status(403).json({
      error: 'Missing permission for your listening history. Log out and log in again to grant it.',
    });
  }
  if (status === 429) {
    return res.status(429).json({ error: 'Spotify is busy right now - try again in a moment.' });
  }
  console.error(`${fallback}:`, err.response?.data || err.message);
  return res.status(500).json({ error: fallback });
}

// The songs this person can legitimately submit for the current challenge,
// straight from Spotify: whatever they're playing right now, plus anything
// in their recently-played history that was played THIS week.
//
// This list is the "verification": the client only ever picks from it, and
// POST /current/complete re-derives it server-side and rejects anything
// that isn't on it - so a completion can't be faked by hand-crafting a
// request. (Spotify's recently-played history only goes back 50 tracks.)
async function getEligibleTracks(sessionId, weekStart) {
  const accessToken = await getValidAccessToken(sessionId);

  const [recent, nowPlaying] = await Promise.all([
    getRecentlyPlayed(accessToken, 50),
    getCurrentlyPlaying(accessToken).catch(() => null), // non-fatal: recent history alone is enough
  ]);

  const tracks = [];
  const seen = new Set();
  const add = (t) => {
    if (!t.trackId || seen.has(t.trackId)) return;
    seen.add(t.trackId);
    tracks.push(t);
  };

  const item = nowPlaying?.item;
  if (item && item.type !== 'episode') {
    add({
      trackId: item.id,
      name: item.name,
      artist: item.artists?.map((a) => a.name).join(', ') || '',
      albumArt: item.album?.images?.[0]?.url || null,
      playedAt: null,
      nowPlaying: true,
    });
  }

  for (const r of recent) {
    if (new Date(r.playedAt).getTime() < weekStart) continue; // only this week's listening counts
    add({
      trackId: r.trackId,
      name: r.name,
      artist: r.artist,
      albumArt: r.albumArt,
      playedAt: r.playedAt,
      nowPlaying: false,
    });
  }

  return tracks;
}

// GET /challenges/current
// This week's challenge + (if logged in) where I stand. Works logged-out
// too, so the frontend can always show the challenge itself.
router.get('/current', async (req, res) => {
  try {
    const week = getWeek();
    const me = await getIdentity(req);

    let mine = null;
    if (me) {
      const [completion, owned] = await Promise.all([
        challengeStore.getCompletion(me.spotifyUserId, week.weekKey),
        getOwnedCosmeticIds(me.spotifyUserId),
      ]);
      mine = {
        completed: !!completion,
        completion: publicCompletion(completion),
        ownsCosmetic: owned.has(week.challenge.cosmetic.id),
      };
    }

    res.json({
      challenge: {
        id: week.challenge.id,
        theme: week.challenge.theme,
        description: week.challenge.description,
        cosmetic: publicCosmetic(week.challenge.cosmetic),
        weekKey: week.weekKey,
        startsAt: week.startsAt,
        endsAt: week.endsAt,
      },
      // Lets the client count down against the SERVER's clock, so a wrong
      // device clock can't show a wrong "time left".
      serverNow: Date.now(),
      participantCount: await challengeStore.countCompletionsForWeek(week.weekKey),
      me: mine,
    });
  } catch (err) {
    console.error('GET /challenges/current failed:', err.message);
    res.status(500).json({ error: 'Could not load this week’s challenge' });
  }
});

// GET /challenges/current/eligible-tracks
router.get('/current/eligible-tracks', async (req, res) => {
  try {
    const me = await getIdentity(req);
    if (!me) return res.status(401).json({ error: 'You need to log in first' });

    const week = getWeek();
    const tracks = await getEligibleTracks(req.sessionID, week.startsAt);
    res.json({ tracks });
  } catch (err) {
    sendError(res, err, 'Could not load your listening history');
  }
});

// POST /challenges/current/complete { trackId }
// Completes this week's challenge with a song the user really listened to,
// and unlocks the week's cosmetic. One completion per user per week.
router.post('/current/complete', async (req, res) => {
  try {
    const me = await getIdentity(req);
    if (!me) return res.status(401).json({ error: 'You need to log in first' });

    const { trackId } = req.body || {};
    if (!trackId || typeof trackId !== 'string') {
      return res.status(400).json({ error: 'trackId is required' });
    }

    const week = getWeek();

    // Cheap early exit before spending a Spotify API call.
    const already = await challengeStore.getCompletion(me.spotifyUserId, week.weekKey);
    if (already) {
      return res.status(409).json({
        error: 'You’ve already completed this week’s challenge',
        completion: publicCompletion(already),
      });
    }

    const eligible = await getEligibleTracks(req.sessionID, week.startsAt);
    const track = eligible.find((t) => t.trackId === trackId);
    if (!track) {
      return res.status(400).json({
        error: 'We couldn’t find that song in your listening this week. Play it on Spotify, then try again.',
      });
    }

    const cosmetic = week.challenge.cosmetic;
    const ownedBefore = await getOwnedCosmeticIds(me.spotifyUserId);

    const { created, completion } = await challengeStore.recordCompletion({
      spotifyUserId: me.spotifyUserId,
      weekKey: week.weekKey,
      challengeId: week.challenge.id,
      theme: week.challenge.theme,
      cosmeticId: cosmetic.id,
      track: { id: track.trackId, name: track.name, artist: track.artist, albumArt: track.albumArt },
      completedAt: Date.now(),
    });

    if (!created) {
      // Lost a race against another request from the same person.
      return res.status(409).json({
        error: 'You’ve already completed this week’s challenge',
        completion: publicCompletion(completion),
      });
    }

    res.json({
      completed: true,
      completion: publicCompletion(completion),
      cosmetic: publicCosmetic(cosmetic),
      // True if a later cycle of the catalog handed out a cosmetic they
      // already have - they still complete the week, but nothing new.
      alreadyOwned: ownedBefore.has(cosmetic.id),
    });
  } catch (err) {
    sendError(res, err, 'Could not complete the challenge');
  }
});

// GET /challenges/rewards
// Everything I've collected, newest first, plus which one is switched on.
router.get('/rewards', async (req, res) => {
  try {
    const me = await getIdentity(req);
    if (!me) return res.status(401).json({ error: 'You need to log in first' });

    const completions = await challengeStore.getCompletions(me.spotifyUserId); // newest first

    // One card per cosmetic. Walk oldest -> newest so the first time a
    // cosmetic shows up is when it was first earned; any later repeat
    // (the catalog cycles) just bumps timesEarned.
    const byCosmetic = new Map();
    for (const c of [...completions].reverse()) {
      const cosmetic = getCosmeticById(c.cosmeticId);
      if (!cosmetic) continue; // removed from the catalog - skip rather than break the page
      const existing = byCosmetic.get(cosmetic.id);
      if (existing) {
        existing.timesEarned += 1;
      } else {
        byCosmetic.set(cosmetic.id, {
          cosmetic: publicCosmetic(cosmetic),
          earnedAt: c.completedAt,
          weekKey: c.weekKey,
          theme: c.theme,
          track: c.track,
          timesEarned: 1,
        });
      }
    }
    const rewards = Array.from(byCosmetic.values()).sort((a, b) => b.earnedAt - a.earnedAt);

    const activeId = await challengeStore.getActiveCosmeticId(me.spotifyUserId);
    res.json({
      rewards,
      activeCosmeticId: activeId && byCosmetic.has(activeId) ? activeId : null,
    });
  } catch (err) {
    console.error('GET /challenges/rewards failed:', err.message);
    res.status(500).json({ error: 'Could not load your rewards' });
  }
});

// PUT /challenges/active-cosmetic { cosmeticId: string | null }
// Switches one of MY unlocked cosmetics on (replacing whichever was on), or
// off with null. You can only wear what you've earned.
router.put('/active-cosmetic', async (req, res) => {
  try {
    const me = await getIdentity(req);
    if (!me) return res.status(401).json({ error: 'You need to log in first' });

    const { cosmeticId } = req.body || {};
    if (cosmeticId !== null && typeof cosmeticId !== 'string') {
      return res.status(400).json({ error: 'cosmeticId must be a string or null' });
    }

    if (cosmeticId !== null) {
      const owned = await getOwnedCosmeticIds(me.spotifyUserId);
      if (!getCosmeticById(cosmeticId) || !owned.has(cosmeticId)) {
        return res.status(403).json({ error: 'You haven’t unlocked that reward yet' });
      }
    }

    await challengeStore.setActiveCosmeticId(me.spotifyUserId, cosmeticId);
    res.json({ activeCosmetic: cosmeticId ? publicCosmetic(getCosmeticById(cosmeticId)) : null });
  } catch (err) {
    console.error('PUT /challenges/active-cosmetic failed:', err.message);
    res.status(500).json({ error: 'Could not update your cosmetic' });
  }
});

module.exports = router;
