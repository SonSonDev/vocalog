-- Append-only journal of voice events: the source of truth.
CREATE TABLE voice_events (
  id          INTEGER PRIMARY KEY,
  guild_id    TEXT    NOT NULL,
  user_id     TEXT    NOT NULL,
  channel_id  TEXT,
  kind        TEXT    NOT NULL CHECK (kind IN ('join', 'leave', 'move', 'state')),
  flags       INTEGER NOT NULL DEFAULT 0,
  at_ms       INTEGER NOT NULL,
  source      TEXT    NOT NULL CHECK (source IN ('live', 'reconcile')),
  raw_json    TEXT    NOT NULL
);
CREATE INDEX idx_voice_events_guild_at ON voice_events (guild_id, at_ms);
CREATE INDEX idx_voice_events_user_at  ON voice_events (guild_id, user_id, at_ms);

-- Events are never modified. (Deletion on a member's own request is handled by a dedicated procedure later.)
CREATE TRIGGER voice_events_no_update
BEFORE UPDATE ON voice_events
BEGIN
  SELECT RAISE(ABORT, 'voice_events is append-only');
END;

-- One row per minute while the collector runs; used only to close sessions after an outage.
CREATE TABLE heartbeats (
  at_ms INTEGER PRIMARY KEY
);

CREATE TABLE guilds (
  id         TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  updated_ms INTEGER NOT NULL
);

CREATE TABLE channels (
  id         TEXT PRIMARY KEY,
  guild_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  updated_ms INTEGER NOT NULL
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  updated_ms INTEGER NOT NULL
);
