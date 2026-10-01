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