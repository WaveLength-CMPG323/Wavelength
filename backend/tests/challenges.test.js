const Module = require('module');
const path = require('path');
const assert = require('assert');
const B = path.join(__dirname, '..');

// ---- stub express (just enough Router to capture handlers) ----
const routes = {};
function makeRouter() {
  const r = { _r: {} };
  for (const m of ['get', 'post', 'put']) r[m] = (p, fn) => { r._r[`${m.toUpperCase()} ${p}`] = fn; };
  return r;
}
// ---- stub spotifyClient (axios isn't installed here) ----
const spotify = { recent: [], current: null, recentErr: null };
const stubs = {
  express: { Router: makeRouter, json: () => {} },
  [path.join(B, 'lib/spotifyClient.js')]: {
    getRecentlyPlayed: async () => { if (spotify.recentErr) throw spotify.recentErr; return spotify.recent; },
    getCurrentlyPlaying: async () => spotify.current,
    refreshAccessToken: async () => ({ access_token: 'refreshed', expires_in: 3600 }),
    exchangeCodeForTokens: async () => ({}), getMyProfile: async () => ({}),
  },
};
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === 'express') return stubs.express;
  try {
    const resolved = Module._resolveFilename(request, parent);
    if (stubs[resolved]) return stubs[resolved];
  } catch {}
  return origLoad.call(this, request, parent, ...rest);
};
delete process.env.DATABASE_URL; // in-memory mode

const { saveTokens } = require(B + '/db/tokenStore');
const challenges = require(B + '/lib/challenges');
const challengeRouter = require(B + '/routes/challenges');
const authRouter = require(B + '/routes/auth');
const H = challengeRouter._r;

async function call(router, key, { session = 's1', body } = {}) {
  let out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await router._r[key]({ sessionID: session, body }, res);
  return out;
}

// pin the clock
let NOW = Date.UTC(2026, 9, 6, 12, 0, 0); // Tue 6 Oct 2026
Date.now = () => NOW;
const DAY = 86400000;

(async () => {
  // ---------- catalog sanity ----------
  const cosIds = challenges.CHALLENGES.map((c) => c.cosmeticId);
  assert.strictEqual(new Set(cosIds).size, cosIds.length, 'each challenge has its own cosmetic');
  cosIds.forEach((id) => assert(challenges.getCosmeticById(id), 'cosmetic exists: ' + id));
  assert.strictEqual(new Set(challenges.CHALLENGES.map((c) => c.id)).size, challenges.CHALLENGES.length);

  // ---------- weekly rotation ----------
  const w = challenges.getWeek(NOW);
  assert.strictEqual(w.weekKey, '2026-10-05');
  assert.strictEqual(new Date(w.startsAt).getUTCDay(), 1, 'weeks start on Monday');
  assert.strictEqual(w.endsAt - w.startsAt, 7 * DAY);
  assert(w.startsAt <= NOW && NOW < w.endsAt);
  // same week all week, new one the second the week ends
  assert.strictEqual(challenges.getWeek(w.startsAt).weekKey, w.weekKey);
  assert.strictEqual(challenges.getWeek(w.endsAt - 1).weekKey, w.weekKey);
  const next = challenges.getWeek(w.endsAt);
  assert.notStrictEqual(next.weekKey, w.weekKey);
  assert.notStrictEqual(next.challenge.id, w.challenge.id);
  assert.notStrictEqual(next.challenge.cosmetic.id, w.challenge.cosmetic.id);
  // 3 years of consecutive weeks: never the same cosmetic two weeks running, always valid
  let prev = null;
  for (let i = 0; i < 160; i++) {
    const wk = challenges.getWeek(w.startsAt + i * 7 * DAY + 3 * DAY);
    assert(wk.challenge.cosmetic, 'week ' + i);
    if (prev) assert.notStrictEqual(wk.challenge.cosmetic.id, prev, 'consecutive weeks differ');
    prev = wk.challenge.cosmetic.id;
  }
  // before the anchor date still works (negative index)
  assert(challenges.getWeek(Date.UTC(2023, 5, 1)).challenge.cosmetic);
  // cycle repeats exactly every N weeks
  const n = challenges.CHALLENGES.length;
  assert.strictEqual(challenges.getWeek(NOW + n * 7 * DAY).challenge.id, w.challenge.id);
  // timezone offset: SAST (UTC+2) -> rolls over Sunday 22:00 UTC
  process.env.CHALLENGE_TZ_OFFSET_HOURS = '2';
  const sast = challenges.getWeek(NOW);
  assert.strictEqual(sast.startsAt, Date.UTC(2026, 9, 4, 22, 0, 0));
  assert.strictEqual(sast.weekKey, '2026-10-05');
  delete process.env.CHALLENGE_TZ_OFFSET_HOURS;
  console.log('PASS rotation / catalog / timezone');

  // ---------- logged out ----------
  let r = await call(challengeRouter, 'GET /current', { session: 'nobody' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.me, null);
  assert.strictEqual(r.body.challenge.weekKey, '2026-10-05');
  assert.strictEqual(r.body.participantCount, 0);
  for (const k of ['GET /current/eligible-tracks', 'GET /rewards']) assert.strictEqual((await call(challengeRouter, k, { session: 'nobody' })).status, 401);
  assert.strictEqual((await call(challengeRouter, 'POST /current/complete', { session: 'nobody', body: { trackId: 'x' } })).status, 401);
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { session: 'nobody', body: { cosmeticId: null } })).status, 401);
  console.log('PASS logged-out access');

  // ---------- log in (session s1 -> spotify account alice) ----------
  await saveTokens('s1', { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600e3, spotifyUserId: 'alice', displayName: 'Alice' });

  r = await call(challengeRouter, 'GET /current');
  assert.strictEqual(r.body.me.completed, false); assert.strictEqual(r.body.me.ownsCosmetic, false);

  // eligibility: filters last week's plays, dedupes, puts now-playing first, ignores podcasts/local files
  const thisWeek = new Date(NOW - 1 * DAY).toISOString();
  const lastWeek = new Date(w.startsAt - 1 * DAY).toISOString();
  spotify.recent = [
    { trackId: 't1', name: 'Song 1', artist: 'A', albumArt: 'u1', playedAt: thisWeek },
    { trackId: 't1', name: 'Song 1', artist: 'A', albumArt: 'u1', playedAt: thisWeek }, // dup
    { trackId: 'old', name: 'Old', artist: 'B', albumArt: null, playedAt: lastWeek },     // last week
    { trackId: null, name: 'Local file', artist: 'C', albumArt: null, playedAt: thisWeek },
    { trackId: 't2', name: 'Song 2', artist: 'D', albumArt: null, playedAt: thisWeek },
  ];
  spotify.current = { item: { id: 'live', type: 'track', name: 'Live', artists: [{ name: 'X' }, { name: 'Y' }], album: { images: [{ url: 'art' }] } } };
  r = await call(challengeRouter, 'GET /current/eligible-tracks');
  assert.deepStrictEqual(r.body.tracks.map((t) => t.trackId), ['live', 't1', 't2']);
  assert.strictEqual(r.body.tracks[0].artist, 'X, Y'); assert.strictEqual(r.body.tracks[0].nowPlaying, true);
  spotify.current = { item: { id: 'pod', type: 'episode', name: 'Pod', artists: [] } };
  assert(!(await call(challengeRouter, 'GET /current/eligible-tracks')).body.tracks.some((t) => t.trackId === 'pod'));
  spotify.current = null;
  console.log('PASS eligible tracks');

  // ---------- completion verification ----------
  assert.strictEqual((await call(challengeRouter, 'POST /current/complete', { body: {} })).status, 400);
  assert.strictEqual((await call(challengeRouter, 'POST /current/complete', { body: { trackId: 123 } })).status, 400);
  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 'never-played' } });
  assert.strictEqual(r.status, 400, 'cannot claim a song you did not play');
  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 'old' } });
  assert.strictEqual(r.status, 400, 'last week\'s plays do not count');
  assert.strictEqual((await call(challengeRouter, 'GET /rewards')).body.rewards.length, 0, 'failed attempts grant nothing');

  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 't1' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.completed, true);
  assert.strictEqual(r.body.cosmetic.id, w.challenge.cosmetic.id); assert.strictEqual(r.body.alreadyOwned, false);
  assert.strictEqual(r.body.completion.track.name, 'Song 1');
  const week1Cosmetic = r.body.cosmetic.id;

  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 't2' } });
  assert.strictEqual(r.status, 409, 'only one completion per week');
  r = await call(challengeRouter, 'GET /current');
  assert.strictEqual(r.body.me.completed, true); assert.strictEqual(r.body.participantCount, 1);
  console.log('PASS completion verification + once per week');

  // ---------- spotify failures ----------
  spotify.recentErr = Object.assign(new Error('x'), { response: { status: 403 } });
  assert.strictEqual((await call(challengeRouter, 'GET /current/eligible-tracks')).status, 403);
  spotify.recentErr = null;

  // ---------- rewards + equip/toggle ----------
  r = await call(challengeRouter, 'GET /rewards');
  assert.strictEqual(r.body.rewards.length, 1); assert.strictEqual(r.body.rewards[0].cosmetic.id, week1Cosmetic);
  assert.strictEqual(r.body.activeCosmeticId, null, 'not auto-equipped');
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: 'coral-glow' } })).status === 403 || week1Cosmetic === 'coral-glow', true, 'cannot equip an unowned cosmetic');
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: 'nope' } })).status, 403);
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: 5 } })).status, 400);
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { body: {} })).status, 400);
  r = await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: week1Cosmetic } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.activeCosmetic.id, week1Cosmetic);
  assert.strictEqual((await call(challengeRouter, 'GET /rewards')).body.activeCosmeticId, week1Cosmetic);

  // home screen: /auth/me carries the equipped cosmetic
  r = await call(authRouter, 'GET /me');
  assert.strictEqual(r.body.loggedIn, true); assert.strictEqual(r.body.profile.activeCosmetic.id, week1Cosmetic);
  assert.strictEqual(r.body.profile.activeCosmetic.kind, challenges.getCosmeticById(week1Cosmetic).kind);

  r = await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: null } });
  assert.strictEqual(r.body.activeCosmetic, null);
  assert.strictEqual((await call(authRouter, 'GET /me')).body.profile.activeCosmetic, null);
  await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: week1Cosmetic } });
  console.log('PASS rewards, equip, toggle off, /auth/me');

  // ---------- permanence: survive logout / new browser ----------
  await saveTokens('s2-new-browser', { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600e3, spotifyUserId: 'alice' });
  r = await call(challengeRouter, 'GET /rewards', { session: 's2-new-browser' });
  assert.strictEqual(r.body.rewards.length, 1); assert.strictEqual(r.body.activeCosmeticId, week1Cosmetic);
  // another person is unaffected
  await saveTokens('s3', { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600e3, spotifyUserId: 'bob' });
  r = await call(challengeRouter, 'GET /rewards', { session: 's3' });
  assert.strictEqual(r.body.rewards.length, 0); assert.strictEqual(r.body.activeCosmeticId, null);
  assert.strictEqual((await call(challengeRouter, 'PUT /active-cosmetic', { session: 's3', body: { cosmeticId: week1Cosmetic } })).status, 403, 'cannot wear someone else\'s reward');
  console.log('PASS permanence + isolation between users');

  // ---------- NEXT WEEK: new challenge, new cosmetic, collection grows ----------
  NOW = w.endsAt + 2 * 3600e3; // Monday morning, week 2
  spotify.recent = [{ trackId: 't9', name: 'Song 9', artist: 'Z', albumArt: null, playedAt: new Date(NOW - 3600e3).toISOString() }];
  r = await call(challengeRouter, 'GET /current');
  assert.notStrictEqual(r.body.challenge.id, w.challenge.id, 'a NEW challenge');
  assert.strictEqual(r.body.me.completed, false, 'fresh slate each week');
  assert.strictEqual(r.body.participantCount, 0);
  // last week's songs no longer count
  assert.strictEqual((await call(challengeRouter, 'POST /current/complete', { body: { trackId: 't1' } })).status, 400);
  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 't9' } });
  assert.strictEqual(r.status, 200); const week2Cosmetic = r.body.cosmetic.id;
  assert.notStrictEqual(week2Cosmetic, week1Cosmetic, 'a DIFFERENT cosmetic');
  r = await call(challengeRouter, 'GET /rewards');
  assert.deepStrictEqual(r.body.rewards.map((x) => x.cosmetic.id), [week2Cosmetic, week1Cosmetic], 'collection, newest first');
  assert.strictEqual(r.body.activeCosmeticId, week1Cosmetic, 'week-1 reward stays on, still usable');
  // swap
  r = await call(challengeRouter, 'PUT /active-cosmetic', { body: { cosmeticId: week2Cosmetic } });
  assert.strictEqual(r.body.activeCosmetic.id, week2Cosmetic);
  console.log('PASS week rollover: new challenge + new cosmetic + collection');

  // ---------- 12 weeks later the catalog cycles: repeat is handled ----------
  NOW = w.startsAt + n * 7 * DAY + 3600e3;
  spotify.recent = [{ trackId: 't77', name: 'Again', artist: 'Q', albumArt: null, playedAt: new Date(NOW - 3600e3).toISOString() }];
  r = await call(challengeRouter, 'GET /current');
  assert.strictEqual(r.body.challenge.cosmetic.id, week1Cosmetic); assert.strictEqual(r.body.me.ownsCosmetic, true);
  r = await call(challengeRouter, 'POST /current/complete', { body: { trackId: 't77' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.alreadyOwned, true);
  r = await call(challengeRouter, 'GET /rewards');
  assert.strictEqual(r.body.rewards.length, 2, 'no duplicate cards');
  assert.strictEqual(r.body.rewards.find((x) => x.cosmetic.id === week1Cosmetic).timesEarned, 2);
  console.log('PASS catalog cycle / duplicate cosmetic');

  // ---------- concurrency: double-submit race ----------
  NOW += 7 * DAY;
  spotify.recent = [{ trackId: 'race', name: 'R', artist: 'R', albumArt: null, playedAt: new Date(NOW - 1000).toISOString() }];
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => call(challengeRouter, 'POST /current/complete', { body: { trackId: 'race' } })));
  assert.strictEqual(results.filter((x) => x.status === 200).length, 1, 'exactly one winner');
  assert.strictEqual(results.filter((x) => x.status === 409).length, 4);
  console.log('PASS double-submit race');

  console.log('\nALL BACKEND TESTS PASSED');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
