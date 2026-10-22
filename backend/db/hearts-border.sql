-- HEARTS & STARS: a gifted border (pink hearts and white stars all over).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- It is NOT a weekly-challenge reward: the challenge rotation only ever draws
-- from the list in backend/lib/challengePool.js, which does not contain it, so
-- no challenge will ever offer it. People only get it from step 2 or 3 below.
--
-- The artwork is frontend/public/borders/hearts-*.svg and the entry in
-- frontend/src/lib/borders.ts - deploy the frontend before using it.

-- 1. Create the border -------------------------------------------------------
INSERT INTO public.rewards (reward_id, name, description, effect_type, css_class)
VALUES (
  'border-hearts',
  'Hearts & Stars',
  'Pink hearts and white stars scattered all around your profile picture and your ocean song marker.',
  'both',
  'hearts'
)
ON CONFLICT (reward_id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      effect_type = EXCLUDED.effect_type,
      css_class = EXCLUDED.css_class;

-- 2. Give it to one person (replace the id; find it with
--    SELECT spotify_user_id, display_name FROM public.known_profiles;) ---------
INSERT INTO public.user_cosmetics (spotify_user_id, reward_id, is_equipped)
VALUES ('YOUR_SPOTIFY_USER_ID', 'border-hearts', FALSE)
ON CONFLICT (spotify_user_id, reward_id) DO NOTHING;

-- 3. OPTIONAL - give it to everyone who has logged in (leave commented out
--    unless you want that) --------------------------------------------------------
-- INSERT INTO public.user_cosmetics (spotify_user_id, reward_id, is_equipped)
-- SELECT spotify_user_id, 'border-hearts', FALSE FROM public.known_profiles
-- ON CONFLICT (spotify_user_id, reward_id) DO NOTHING;

-- Check it:
-- SELECT reward_id, name, css_class FROM public.rewards WHERE reward_id = 'border-hearts';
-- SELECT * FROM public.user_cosmetics WHERE reward_id = 'border-hearts';

-- If you ever run the optional reset in clean-slate.sql (which empties `rewards`),
-- run step 1 again afterwards to bring this border back.
