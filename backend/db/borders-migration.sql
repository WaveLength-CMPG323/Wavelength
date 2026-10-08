-- BORDERS: connect the new profile / song-marker borders to the database.
-- Run this whole file once in the Supabase SQL editor. Safe to re-run.
--
-- It does three things:
--   1. Adds (or refreshes) the 8 border rewards. The `css_class` column is the
--      artwork's name - it must match a file set in frontend/public/borders
--      and an entry in frontend/src/lib/borders.ts.
--   2. Retires the old colour-glow rewards (cyan-border, gold-border and the
--      aura-* colours): anyone who had one equipped loses it, and old
--      challenges forget which reward they gave. Weekly challenges only ever
--      use the new borders from here on.
--   3. Points the challenge that is running right now at a new border, so it
--      doesn't keep pointing at a retired one.
--
-- Step 2 is the destructive one. If you already ran clean-slate.sql nobody owns
-- an old border and nothing is lost.

-- 1. The borders ---------------------------------------------------------
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
ON CONFLICT (reward_id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      effect_type = EXCLUDED.effect_type,
      css_class = EXCLUDED.css_class;

-- 2. Retire the old colour-glow rewards ----------------------------------
UPDATE public.challenges SET reward_id = NULL
  WHERE reward_id IS NOT NULL AND reward_id NOT LIKE 'border-%';
DELETE FROM public.user_cosmetics WHERE reward_id NOT LIKE 'border-%';
DELETE FROM public.rewards WHERE reward_id NOT LIKE 'border-%';

-- 3. Give the live challenge a border ------------------------------------
-- (picks one that no earlier challenge has used yet; the backend does the same
-- at every rotation from now on)
UPDATE public.challenges
SET reward_id = (
  SELECT r.reward_id FROM public.rewards r
  WHERE r.reward_id NOT IN (SELECT c.reward_id FROM public.challenges c WHERE c.reward_id IS NOT NULL)
  ORDER BY random() LIMIT 1)
WHERE is_active = TRUE AND reward_id IS NULL;

-- (only if every border has somehow been used already, fall back to this one)
UPDATE public.challenges SET reward_id = 'border-bubble-ring'
WHERE is_active = TRUE AND reward_id IS NULL;

-- Check the result:
-- SELECT reward_id, name, css_class FROM public.rewards ORDER BY reward_id;
-- SELECT id, theme, reward_id, is_active FROM public.challenges ORDER BY id DESC LIMIT 5;
