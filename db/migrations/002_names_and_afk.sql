-- Additive only: the previous version of the bot keeps working on this schema (it never selects these columns).

-- The AFK voice channel of a server (current value), to separate AFK time from real voice time later.
ALTER TABLE guilds ADD COLUMN afk_channel_id TEXT;

-- Channel type: 2 = voice, 13 = stage.
ALTER TABLE channels ADD COLUMN type INTEGER;

-- Name of a person as shown on one server (nickname, else global display name, else username).
CREATE TABLE members (
  guild_id     TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  display_name TEXT    NOT NULL,
  is_bot       INTEGER NOT NULL DEFAULT 0,
  updated_ms   INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Every name an entity has had, so renaming a channel or a person does not rewrite the past.
-- kind: 'guild' | 'channel' | 'user' (global username) | 'member' (display name on one server, entity_id = user id).
CREATE TABLE name_history (
  kind      TEXT    NOT NULL CHECK (kind IN ('guild', 'channel', 'user', 'member')),
  entity_id TEXT    NOT NULL,
  guild_id  TEXT,
  name      TEXT    NOT NULL,
  at_ms     INTEGER NOT NULL
);
CREATE INDEX idx_name_history_entity ON name_history (kind, entity_id, at_ms);
