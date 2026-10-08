-- Run once in Supabase's SQL editor before setting DATABASE_URL - adds the
-- constraints our upsert-style queries rely on; the tables already exist.
ALTER TABLE public.private_conversations
  ADD CONSTRAINT private_conversations_pair_unique
  UNIQUE (user_a_spotify_user_id, user_b_spotify_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS chat_requests_one_pending_pair
  ON public.chat_requests (from_spotify_user_id, to_spotify_user_id)
  WHERE status = 'pending';

-- A small, permanent cache of "last known" display name/avatar per real
-- Spotify account, separate from spotify_tokens. spotify_tokens' row for a
-- user is deleted outright on logout (see tokenStore.deleteTokens) so the
-- poller stops retrying a dead session - but that also wiped the only copy
-- of that person's name/photo, so anyone who still had a pending request
-- or an accepted chat with them would see their raw Spotify account id
-- ("client id") instead of a name once they logged out. This table is
-- upserted on every login/token save and is never deleted, so a name
-- keeps showing even after the owner logs out.
CREATE TABLE IF NOT EXISTS public.known_profiles (
  spotify_user_id TEXT PRIMARY KEY,
  display_name TEXT,
  profile_url TEXT,
  profile_image TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A nickname and short bio a person sets for themselves on their own
-- profile page. Lives on known_profiles (not spotify_tokens) because it's
-- the one table that already survives logout - a nickname someone set
-- should keep showing in chats/friends lists even after they log out,
-- same as their cached display name/avatar above.
ALTER TABLE public.known_profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.known_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
