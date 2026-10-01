CREATE TABLE challenges (
  id SERIAL PRIMARY KEY,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_id TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX unique_active_challenge 
ON challenges (is_active) 
WHERE is_active = TRUE;

CREATE TABLE challenge_submissions (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER REFERENCES challenges(id),
  spotify_user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_art TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, spotify_user_id)
);

-- 1. List of available cosmetic rewards
CREATE TABLE rewards (
  reward_id TEXT PRIMARY KEY, -- e.g 'cyan-border', 'gold-border'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_type TEXT NOT NULL, -- e.g 'profile_aura', 'song_marker', or 'both'
  css_class TEXT NOT NULL   -- e.g 'cyan-glow', 'gold-shimmer'
);

-- 2. Track which users have unlocked and equipped which cosmetics
CREATE TABLE user_cosmetics (
  id SERIAL PRIMARY KEY,
  spotify_user_id TEXT NOT NULL,
  reward_id TEXT REFERENCES rewards(reward_id),
  is_equipped BOOLEAN DEFAULT FALSE,
  UNIQUE(spotify_user_id, reward_id)
);

-- 1. Songs from before 2000
INSERT INTO challenges (theme, description, reward_id, deadline, is_active)
VALUES (
  'Throwback Anthems', 
  'Share a track released before the year 2000 that defines a generation. Entering unlocks a themed profile border.', 
  'cyan-border', 
  '2026-10-07 23:59:59+00', 
  TRUE
)
RETURNING id;

-- 2. Songs with Gold in the name
INSERT INTO challenges (theme, description, reward_id, deadline, is_active)
VALUES (
  'Golden Tide', 
  'Share a track featuring gold or shining imagery in its theme or title.', 
  'gold-border', 
  '2026-09-30 23:59:59+00', 
  FALSE
);

-- Insert cosmetic rewards
INSERT INTO rewards (reward_id, name, description, effect_type, css_class)
VALUES 
  ('cyan-border', 'Abyssal Crest', 'Bioluminescent cyan glow applied to your avatar aura and your floating ocean song marker.', 'both', 'cyan-glow'),
  ('gold-border', 'Golden Tide', 'Radiant golden shimmer applied to your avatar aura and your floating ocean song marker.', 'both', 'gold-shimmer')
ON CONFLICT (reward_id) DO NOTHING;