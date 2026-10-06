# WaveLength — Spotify Login Backend

Minimal Express backend implementing Spotify OAuth login and a
`currently-playing` endpoint for the Ocean team to poll.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then fill in `.env`:
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — from your app in the
  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- `SPOTIFY_REDIRECT_URI` — must exactly match a Redirect URI registered
  in that dashboard. Use `http://localhost:3000/auth/callback` for now.
- `FRONTEND_URL` — wherever your frontend runs locally (e.g. Vite's
  default `http://localhost:5173`).
- `DATABASE_URL` — leave this line out entirely (or comment it with a
  leading `#`) until your real Postgres connection string is ready.
  If it's set to anything — even the placeholder value — the app will
  try to connect to a real database and fail. With it unset, tokens
  are stored in memory so you can test the login flow immediately.
- `SESSION_SECRET` — any long random string, used to sign session
  cookies. Generate one with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 3. Register the redirect URI with Spotify

In the Spotify Developer Dashboard, open your app → Settings →
Redirect URIs, and add:

```
http://localhost:3000/auth/callback
```

You can add multiple URIs, so later you'll also add your Render
backend URL (e.g. `https://wavelength-api.onrender.com/auth/callback`)
without removing the localhost one.

## 4. (When Postgres is ready) create the tokens table

```sql
CREATE TABLE spotify_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  spotify_user_id TEXT,
  display_name TEXT,
  profile_url TEXT,
  email TEXT,
  profile_image TEXT
);
```

If you created this table BEFORE the ocean feature's account-dedup/host-name
update, run this once against your existing table instead of recreating it:

```sql
ALTER TABLE spotify_tokens ADD COLUMN IF NOT EXISTS spotify_user_id TEXT;
ALTER TABLE spotify_tokens ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE spotify_tokens ADD COLUMN IF NOT EXISTS profile_url TEXT;
```

If you created this table BEFORE the profile page's email/avatar/recently-played
update, run this once too:

```sql
ALTER TABLE spotify_tokens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE spotify_tokens ADD COLUMN IF NOT EXISTS profile_image TEXT;
```

Run this once against your hosted Postgres instance, then set
`DATABASE_URL` in `.env`. Restart the server — the console log will
stop warning about in-memory storage.

## 5. Run it

```bash
npm start
```

Then visit `http://localhost:3000/auth/login` in a browser. It should
redirect you to Spotify, ask you to approve access, then bounce back
to `FRONTEND_URL/dashboard` (that frontend route doesn't need to exist
yet — you're just confirming the redirect happens without errors).

Check your server logs / DB for the saved tokens to confirm it worked.

## 6. Give Ocean their endpoint

Once login works, `GET http://localhost:3000/spotify/currently-playing`
returns:

```json
{ "playing": true, "track": "...", "artist": "...", "progressMs": 12345, "durationMs": 210000 }
```

or `{ "playing": false }` if nothing's playing. This is what their
polling job should hit.

## Multi-user support

Each browser now gets its own session (a `connect.sid` cookie, set up
in `server.js` via `express-session`). Tokens are stored keyed by
`req.sessionID`, so multiple teammates can log in independently —
either on separate machines running their own copy, or in separate
browsers/incognito windows on the same machine — without overwriting
each other's tokens.

Two things worth knowing:
- Like the in-memory token store, sessions also live in memory by
  default and reset when the server restarts. This is fine for local
  dev; if you want sessions to survive restarts once Postgres is
  connected, a package like `connect-pg-simple` can persist them
  there too (not set up yet — flag it if you need it).
- `req.sessionID` is a random, un-meaningful string — it's not a
  username. Once you build real accounts, you'll likely want to swap
  this for an actual user ID from your database, tied to sessionID
  via login (e.g. `req.session.userId = user.id`).

## Pushing this to GitHub

If this project isn't in a Git repo yet:

```bash
git init
git add .
git commit -m "Initial Spotify login backend"
```

`.gitignore` is already set up to exclude `node_modules/` and `.env`
— your Spotify secrets will never get pushed, and teammates won't
download a stale copy of your dependencies.

Then on GitHub.com: create a new empty repository (don't initialize
it with a README, since you already have one — that avoids a merge
conflict). Copy the commands GitHub shows you under "…or push an
existing repository from the command line", something like:

```bash
git remote add origin https://github.com/your-org/wavelength.git
git branch -M main
git push -u origin main
```

**For teammates pulling this down:** after `git clone`, they still
need to run `npm install` themselves (node_modules isn't in the
repo) and create their own `.env` (also not in the repo, since it's
gitignored) with the same Client ID/Secret you're using, plus their
own `SESSION_SECRET`. Point them at this README for the full setup.

## Deploying to Render later

1. Add your Render backend URL as a second Redirect URI in the
   Spotify Dashboard (keep localhost too).
2. Set all the `.env` variables as environment variables in the
   Render service dashboard, with `SPOTIFY_REDIRECT_URI` and
   `FRONTEND_URL` pointing at your deployed URLs instead of localhost.
3. Set `DATABASE_URL` to your hosted Postgres connection string.
4. No code changes needed — it's purely an environment-variable swap.

## Weekly challenges & cosmetic rewards

A new challenge goes live every week, and completing it permanently unlocks
that week's profile cosmetic. Users collect them and choose which one to wear.

**How it works**

- **No scheduler.** The live challenge is calculated from the calendar
  (`lib/challenges.js` → `getWeek()`): each Monday 00:00 UTC the next entry in
  `CHALLENGES` takes over, cycling forever. Set `CHALLENGE_TZ_OFFSET_HOURS`
  (e.g. `2` for South Africa) to roll over at local midnight instead.
- **Verification.** A user can only submit a song they've really played this
  week (now playing + Spotify recently-played). The server re-checks this on
  submit, so it can't be faked from the browser. Uses scopes you already
  request (`user-read-recently-played`).
- **One completion per user per week**, enforced by the database primary key
  (safe against double-clicks / parallel requests).
- **Rewards are permanent** and keyed to the Spotify account id, so they
  survive logout, new browsers and new devices.
- **One cosmetic worn at a time.** Equipping another swaps it; toggling off
  clears it. Only earned cosmetics can be equipped.

**Endpoints** (all under `/challenges`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/current` | This week's challenge, time left, my status (works logged out) |
| GET | `/current/eligible-tracks` | Songs I can submit (heard this week) |
| POST | `/current/complete` `{ trackId }` | Complete the challenge, unlock the cosmetic |
| GET | `/rewards` | All cosmetics I've collected + which is equipped |
| PUT | `/active-cosmetic` `{ cosmeticId \| null }` | Equip / unequip |

`/auth/me` and `/spotify/user/:id` now also return `activeCosmetic`, which is
how the home screen and profile pages know what to draw.

**Database.** Needs Postgres (`DATABASE_URL`) for rewards to be truly
permanent - with the in-memory fallback they reset when the server restarts.
The tables are created automatically on startup; for reference:

```sql
CREATE TABLE IF NOT EXISTS challenge_completions (
  spotify_user_id TEXT NOT NULL,
  week_key        TEXT NOT NULL,
  challenge_id    TEXT NOT NULL,
  theme           TEXT NOT NULL,
  cosmetic_id     TEXT NOT NULL,
  track_id        TEXT NOT NULL,
  track_name      TEXT,
  artist          TEXT,
  album_art       TEXT,
  completed_at    BIGINT NOT NULL,
  PRIMARY KEY (spotify_user_id, week_key)
);
CREATE TABLE IF NOT EXISTS profile_cosmetics (
  spotify_user_id    TEXT PRIMARY KEY,
  active_cosmetic_id TEXT
);
```

**Adding content.** Append to `COSMETICS` / `CHALLENGES` in `lib/challenges.js`
(a cosmetic is just an id, a name, a `kind` of `frame` / `glow` / `ripple`, and
two colours). Append only - reordering or inserting in the middle changes which
challenge runs in which week. With 12 entries the cycle repeats every 12 weeks;
a repeat still counts as completing the week but doesn't create a duplicate
reward.

**Tests.** `npm test` runs `tests/challenges.test.js` (rotation, verification,
once-per-week, rewards, equipping, persistence across sessions). It stubs
Spotify and Express, so it needs no credentials or database.
