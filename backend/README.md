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

Each browser is identified by an opaque bearer token, handed back once
by `/auth/callback` (in the URL hash of the redirect back to the
frontend) and sent back on every later request as an `Authorization:
Bearer <token>` header (see `lib/identity.js` and the frontend's
`src/lib/api.ts`/`src/data/AuthContext.tsx`). Tokens are stored keyed
by `req.userId`, so multiple teammates can log in independently —
either on separate machines running their own copy, or in separate
browsers/incognito windows on the same machine — without overwriting
each other's tokens.

Three things worth knowing:
- This intentionally does **not** use `express-session`/`connect.sid`.
  That was tried first, but express-session's session records live in
  RAM by default, so every backend restart (a redeploy, or Render's
  free tier spinning the service down after inactivity) wiped every
  session and silently handed returning browsers a brand new session
  id — which meant `/auth/me` reported them logged out even though
  their Spotify tokens were still sitting there fine (and the
  background poller, which doesn't care about sessions, kept polling
  and showing their song to everyone else).
- It also intentionally does **not** use a cookie at all, even a
  standalone one independent of `express-session` (that was tried
  second). If your frontend and backend end up on two different real
  domains, or two different `*.onrender.com` subdomains like this
  project's default setup, browsers treat them as separate *sites* —
  `onrender.com` is a public suffix, so each subdomain is its own
  registrable domain, unlike e.g. `app.example.com` and
  `api.example.com`, which share `example.com` and count as the same
  site. That makes any identity cookie a third-party cookie, and
  third-party cookies are blocked by default in Safari and Firefox,
  and by a growing share of Chrome installs too — which is exactly why
  it worked for some people and not others, regardless of how
  carefully the cookie's `Secure`/`SameSite` flags were set. A bearer
  token sent as an explicit header isn't a cookie at all, so none of
  that applies to it.
- `req.userId` is a random, un-meaningful string — it's not a
  username. Once you build real accounts, you'll likely want to swap
  this for an actual user ID from your database, tied to the bearer
  token at login time.

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

## Postgres persistence for chat/groups (Supabase)

Chat requests, private/group messages, and groups are now persisted to a
real Postgres database (tested against Supabase) instead of living only in
memory - previously, all of it was lost on every server restart/redeploy.
Spotify token storage already used Postgres the same way; it now shares a
single connection pool with everything else (see `db/pool.js`).

If this project's Supabase tables already exist (the
`spotify_tokens`/`chat_requests`/`private_conversations`/
`private_messages`/`chat_groups`/`chat_group_members`/
`group_join_requests`/`group_messages` tables), there is **one required,
additive migration** to run once, before setting `DATABASE_URL`: open
`db/schema-additions.sql` in this repo and run its contents in Supabase's
SQL editor. It adds two constraints the app's upsert-style queries need (a
uniqueness constraint on conversation pairs, and a partial unique index so
at most one pending chat request can exist per direction), plus one new
table, `known_profiles` - a small permanent cache of each person's display
name/avatar, kept separate from `spotify_tokens` so that logging out (which
deletes that session's `spotify_tokens` row outright, so the poller stops
retrying a dead session) doesn't also erase the only copy of their name.
Without it, anyone who still had a pending chat request from someone, or an
accepted chat with them, would see that person's raw Spotify account id
instead of their name once they logged out. This migration does not touch
any existing data.

Two Supabase-specific things worth knowing:

- **SSL is required and already handled.** Supabase's Postgres requires an
  SSL connection; `db/pool.js` already passes
  `ssl: { rejectUnauthorized: false }` (the standard workaround for hosted
  Postgres providers' certificate chains) - nothing extra to configure.
- **Use the "Transaction pooler" (Supavisor) connection string, not the
  direct connection one.** Supabase's "direct connection" string (port
  `5432`) is IPv6-only unless you pay for their IPv4 add-on, which breaks
  on most IPv4-only hosting egress, including Render's standard web
  services. Instead, go to Supabase's own Database settings page and copy
  the **"Transaction pooler" / Supavisor** connection string (port `6543`)
  into `DATABASE_URL` - it supports IPv4, and is also the right choice for
  a server that opens many short-lived-ish queries rather than a few
  long-lived ones. This is something only you can do (it needs your own
  Supabase dashboard access) - there's no code change involved.

With `DATABASE_URL` unset, everything above still falls back to the
original in-memory stores exactly as before - Postgres is never required
to run this app locally.

Weekly Challenges (the themed song-submission feature, plus the cosmetic
rewards it unlocks) needs four more tables -
`challenges`/`challenge_submissions`/`rewards`/`user_cosmetics`. See
`db/challenges-schema.sql`: review it against what's already in your
Supabase project before running it (the user has said these tables may
already exist there). It's written to be idempotent
(`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), but it can only
avoid duplicating its two seed challenge rows and two seed reward rows
where a uniqueness check (an existing theme, or the `reward_id` primary
key) already catches the duplicate - so check your existing `challenges`
and `rewards` rows before running the seed `INSERT`s in there, same as
any other migration. Unlike the rest of this backend's Postgres-backed
features, Weekly Challenges has no in-memory fallback - it requires
`DATABASE_URL` to be set.

## Deploying to Render later

1. Add your Render backend URL as a second Redirect URI in the
   Spotify Dashboard (keep localhost too).
2. Set all the `.env` variables as environment variables in the
   Render service dashboard, with `SPOTIFY_REDIRECT_URI` and
   `FRONTEND_URL` pointing at your deployed URLs instead of localhost.
3. Set `DATABASE_URL` to your hosted Postgres connection string.
4. No code changes needed — it's purely an environment-variable swap.
