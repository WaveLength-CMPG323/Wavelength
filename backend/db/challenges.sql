CREATE TABLE challenges (
  id SERIAL PRIMARY KEY,
  theme TEXT NOT NULL,
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
INSERT INTO challenges (theme, deadline, is_active)
VALUES ('Throwback Anthems', '2026-10-07 23:59:59+00', TRUE)
RETURNING id;

-- 2. Songs with Gold in the name
INSERT INTO challenges (theme, deadline, is_active)
VALUES ('Golden Tide', '2026-09-30 23:59:59+00', FALSE);