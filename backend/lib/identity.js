const crypto = require('crypto');

// Wavelength needs a stable way to recognize "this browser" across visits.
//
// Attempt #1 was req.sessionID (express-session) - broke because its
// session records live in RAM and get wiped on every backend restart.
//
// Attempt #2 was a dedicated 'wl_uid' cookie, set once with a long
// lifetime, completely independent of any server-side session store. That
// solved the restart problem, but ran into a DIFFERENT problem: the
// frontend and backend live on two different *.onrender.com subdomains,
// which browsers treat as separate *sites* (onrender.com is a public
// suffix, so each subdomain is its own registrable domain - unlike, say,
// app.example.com and api.example.com, which share example.com and count
// as the same site). That makes the identity cookie a genuine third-party
// cookie from the browser's point of view, and third-party cookies are
// blocked by default in Safari and Firefox, and increasingly in Chrome
// too. That's exactly why it "worked" for one person (whichever browser/
// settings happened to still allow it) and not others - it was never
// reliable in the first place, regardless of the cookie's Secure/SameSite
// flags being set correctly.
//
// The actual fix: stop using a cookie for identity at all. Instead, the
// backend hands back an opaque bearer token once (embedded in the OAuth
// redirect back to the frontend after /auth/callback), the frontend saves
// it in localStorage, and sends it back as a normal `Authorization: Bearer
// <token>` request header on every call. That's not a cookie, so none of
// the SameSite/third-party cookie rules apply to it at all - it works the
// same in every browser, with every privacy setting.
function identifyRequest(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  req.userId = match ? match[1] : null;
  next();
}

function generateUserId() {
  return crypto.randomBytes(20).toString('hex');
}

module.exports = { identifyRequest, generateUserId };
