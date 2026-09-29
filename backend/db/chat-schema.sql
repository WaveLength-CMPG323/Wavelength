CREATE TABLE IF NOT EXISTS chat_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_spotify_user_id TEXT NOT NULL,
  to_spotify_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (from_spotify_user_id <> to_spotify_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_requests_one_pending_pair
  ON chat_requests (from_spotify_user_id, to_spotify_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS private_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_spotify_user_id TEXT NOT NULL,
  user_b_spotify_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a_spotify_user_id < user_b_spotify_user_id),
  UNIQUE (user_a_spotify_user_id, user_b_spotify_user_id)
);

CREATE TABLE IF NOT EXISTS private_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES private_conversations(id) ON DELETE CASCADE,
  sender_spotify_user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_messages_history
  ON private_messages (conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  owner_spotify_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  spotify_user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, spotify_user_id)
);

CREATE INDEX IF NOT EXISTS chat_group_members_by_user
  ON chat_group_members (spotify_user_id, group_id);

CREATE TABLE IF NOT EXISTS group_join_requests (
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  spotify_user_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, spotify_user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_spotify_user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_messages_history
  ON group_messages (group_id, created_at, id);
