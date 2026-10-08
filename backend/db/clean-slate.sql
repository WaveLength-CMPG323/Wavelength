-- CLEAN SLATE: removes every user and everything that belongs to a user.
-- Run in the Supabase SQL editor. IRREVERSIBLE - everyone is logged out
-- and all their chats, groups, challenge entries and earned borders are gone.
--
-- Wiped:  spotify_tokens (logins/sessions), known_profiles (nicknames, bios),
--         chat_requests, private_conversations, private_messages,
--         chat_groups, chat_group_members, group_messages, group_join_requests,
--         challenge_submissions, user_cosmetics.
-- Kept:   challenges (current + history) and rewards. Keeping `challenges`
--         matters: the weekly rotation reads it to know which reward borders
--         have already been used, so none of them is ever offered twice.
--
-- TRUNCATE ... CASCADE also empties any table that points at these ones, so
-- foreign keys can't block it. Tables that don't exist are skipped.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'spotify_tokens',
    'known_profiles',
    'chat_requests',
    'private_messages',
    'private_conversations',
    'group_messages',
    'group_join_requests',
    'chat_group_members',
    'chat_groups',
    'challenge_submissions',
    'user_cosmetics'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'Cleared %', t;
    ELSE
      RAISE NOTICE 'Skipped % (no such table)', t;
    END IF;
  END LOOP;
END $$;

-- OPTIONAL - also reset the weekly challenges so rewards start fresh too
-- (every border becomes available again, a new challenge starts on its own).
-- Only run this if you want that; it is separate on purpose.
-- TRUNCATE TABLE public.challenges, public.rewards RESTART IDENTITY CASCADE;
