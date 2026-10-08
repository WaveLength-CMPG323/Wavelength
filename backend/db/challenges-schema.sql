-- Weekly Challenges / Cosmetics feature.
--
-- The user has said these tables may already exist on Supabase - review
-- this against what's already there before running it. This file is
-- idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING) so it's
-- safe to run even if some of it already exists.

CREATE TABLE IF NOT EXISTS public.challenges (
  id SERIAL PRIMARY KEY,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_id TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_challenge
  ON public.challenges (is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER REFERENCES public.challenges(id),
  spotify_user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_art TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, spotify_user_id)
);

-- 1. List of available cosmetic rewards
CREATE TABLE IF NOT EXISTS public.rewards (
  reward_id TEXT PRIMARY KEY, -- e.g 'border-skeletons'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_type TEXT NOT NULL, -- e.g 'profile_aura', 'song_marker', or 'both'
  css_class TEXT NOT NULL   -- the artwork key, e.g 'skeletons' (see frontend/src/lib/borders.ts)
);

-- 2. Track which users have unlocked and equipped which cosmetics
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id SERIAL PRIMARY KEY,
  spotify_user_id TEXT NOT NULL,
  reward_id TEXT REFERENCES public.rewards(reward_id),
  is_equipped BOOLEAN DEFAULT FALSE,
  UNIQUE(spotify_user_id, reward_id)
);

-- No challenges are seeded here anymore: the backend now starts them on its
-- own (lib/challengeRotation.js) - when nothing is active, or when the active
-- one's deadline passes, it ends it and starts the next one from the pool in
-- lib/challengePool.js, with a fresh start time and deadline. To end the
-- current challenge early and start the next, run:
--   UPDATE public.challenges SET deadline = now() WHERE is_active = TRUE;
-- (it rolls over within ~15 seconds), or call POST /challenges/admin/rotate.

-- Seed cosmetic rewards (the profile / song-marker borders). The backend also
-- creates each one itself when a challenge that grants it starts; this seed
-- just makes them exist up front. Keep in sync with backend/lib/challengePool.js.
INSERT INTO public.rewards (reward_id, name, description, effect_type, css_class)
VALUES
  ('border-bubble-ring', 'Bubble Ring', 'A swarm of glistening bubbles drifting around your profile picture and your ocean song marker.', 'both', 'bubble-ring'),
  ('border-sea-sparkle', 'Sea Sparkle', 'A shimmer of colourful sea sparkles circling your profile picture and your ocean song marker.', 'both', 'sea-sparkle'),
  ('border-pearl-strand', 'Pearl Strand', 'A double strand of lustrous pearls wrapped around your profile picture and your ocean song marker.', 'both', 'pearl-strand'),
  ('border-kelp-wreath', 'Kelp Wreath', 'A lush wreath of swaying kelp framing your profile picture and your ocean song marker.', 'both', 'kelp-wreath'),
  ('border-coral-reef', 'Coral Reef', 'Branching pink and golden coral growing around your profile picture and your ocean song marker.', 'both', 'coral-reef'),
  ('border-starfish-shells', 'Starfish & Shells', 'Starfish, shells and glittering sand scattered around your profile picture and your ocean song marker.', 'both', 'starfish-shells'),
  ('border-skeletons', 'Skeletons', 'Bones, grinning skulls and stegosaurus plates rattling around your profile picture and your ocean song marker.', 'both', 'skeletons'),
  ('border-dino-eggs', 'Dino Eggs', 'Spotted dinosaur eggs nestled in ferns around your profile picture and your ocean song marker.', 'both', 'dino-eggs')
ON CONFLICT (reward_id) DO NOTHING;
