// Tracks "Spotify is refusing us because we've hit a limit" so the app can
// tell people (a pop-up on the frontend) instead of silently showing an
// empty ocean. Two different limits can bite:
//
//  - Rate limit (HTTP 429): too many requests in Spotify's rolling window.
//    Temporary - Spotify says how long to back off (Retry-After). This is
//    tracked globally: while it's active every visitor sees the pop-up, and
//    it clears itself once the back-off window has passed.
//  - User cap (HTTP 403 on login): apps in Spotify's Development Mode only
//    allow a small allow-list of accounts, so a new person can't sign in
//    until the owner raises the quota in the Spotify developer dashboard.
//    That's reported per login attempt (see routes/auth.js), not globally.

const DEFAULT_COOLDOWN_MS = 60 * 1000;
// Spotify can send very long back-offs (hours, even about a day) for apps
// that hit their quota hard, so trust what it says up to 48h.
const MAX_COOLDOWN_MS = 48 * 60 * 60 * 1000;

let until = 0; // epoch ms the rate-limit back-off lasts until (0 = not limited)

function isRateLimitError(err) {
  return err?.response?.status === 429;
}

// Spotify words this 403 a few ways ("User not registered in the Developer
// Dashboard", "...quota..."), so match loosely on the body text.
function isUserCapError(err) {
  if (err?.response?.status !== 403) return false;
  const body = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data || '');
  return /quota|not registered|developer dashboard|allowlist|allow-list/i.test(body);
}

function isActive() {
  return Date.now() < until;
}

function getQuotaStatus() {
  const active = isActive();
  return { reached: active, retryAfterSeconds: active ? Math.ceil((until - Date.now()) / 1000) : 0 };
}

// Call when a Spotify request came back 429. Tells every connected client
// the first time (and each time the window is extended meaningfully).
function noteRateLimit(err, io) {
  const retryAfter = Number(err?.response?.headers?.['retry-after']);
  const ms =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, MAX_COOLDOWN_MS)
      : DEFAULT_COOLDOWN_MS;
  const wasActive = isActive();
  until = Math.max(until, Date.now() + ms);
  if (!wasActive) {
    console.warn(`Spotify rate limit hit - backing off for about ${Math.ceil(ms / 1000)}s.`);
    if (io) io.emit('spotify:quota', getQuotaStatus());
  }
}

// Call periodically; tells clients to drop the pop-up once the window is over.
let announcedReached = false;
function syncQuotaAnnouncement(io) {
  const active = isActive();
  if (active) {
    announcedReached = true;
  } else if (announcedReached) {
    announcedReached = false;
    if (io) io.emit('spotify:quota', getQuotaStatus());
  }
}

function isRateLimited() {
  return isActive();
}

module.exports = { isRateLimited, isRateLimitError, isUserCapError, noteRateLimit, getQuotaStatus, syncQuotaAnnouncement };
