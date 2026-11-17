import type { VoiceEvent } from '@vocalog/shared';
import type { Db } from './db.ts';

interface EventRow {
  guild_id: string;
  user_id: string;
  channel_id: string | null;
  kind: VoiceEvent['kind'];
  flags: number;
  at_ms: number;
  source: VoiceEvent['source'];
}

/** Appends one event to the journal. `raw` is kept as JSON next to the normalised columns. */
export function insertEvent(db: Db, event: VoiceEvent, raw: unknown): void {
  db.prepare(
    `INSERT INTO voice_events (guild_id, user_id, channel_id, kind, flags, at_ms, source, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(event.guildId, event.userId, event.channelId, event.kind, event.flags, event.atMs, event.source, JSON.stringify(raw));
}

export function loadEvents(db: Db): VoiceEvent[] {
  const rows = db
    .prepare('SELECT guild_id, user_id, channel_id, kind, flags, at_ms, source FROM voice_events ORDER BY at_ms, id')
    .all() as EventRow[];
  return rows.map((row) => ({
    guildId: row.guild_id,
    userId: row.user_id,
    channelId: row.channel_id,
    kind: row.kind,
    flags: row.flags,
    atMs: row.at_ms,
    source: row.source,
  }));
}

export function recordHeartbeat(db: Db, atMs: number): void {
  db.prepare('INSERT OR IGNORE INTO heartbeats (at_ms) VALUES (?)').run(atMs);
}

export function lastHeartbeat(db: Db): number | null {
  const row = db.prepare('SELECT MAX(at_ms) AS at_ms FROM heartbeats').get() as { at_ms: number | null };
  return row.at_ms;
}

type NameKind = 'guild' | 'channel' | 'user' | 'member';

/** Appends to the name history when the name differs from the last known one (or is the first sight). */
function logName(db: Db, kind: NameKind, entityId: string, guildId: string | null, name: string, previous: string | undefined, nowMs: number): void {
  if (previous === name) return;
  db.prepare('INSERT INTO name_history (kind, entity_id, guild_id, name, at_ms) VALUES (?, ?, ?, ?, ?)').run(kind, entityId, guildId, name, nowMs);
}

export function upsertGuild(db: Db, guild: { id: string; name: string; afkChannelId: string | null }, nowMs: number): void {
  db.transaction(() => {
    const previous = db.prepare('SELECT name FROM guilds WHERE id = ?').get(guild.id) as { name: string } | undefined;
    db.prepare(
      `INSERT INTO guilds (id, name, afk_channel_id, updated_ms) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, afk_channel_id = excluded.afk_channel_id, updated_ms = excluded.updated_ms`,
    ).run(guild.id, guild.name, guild.afkChannelId, nowMs);
    logName(db, 'guild', guild.id, null, guild.name, previous?.name, nowMs);
  })();
}

export function upsertChannel(db: Db, channel: { id: string; guildId: string; name: string; type: number }, nowMs: number): void {
  db.transaction(() => {
    const previous = db.prepare('SELECT name FROM channels WHERE id = ?').get(channel.id) as { name: string } | undefined;
    db.prepare(
      `INSERT INTO channels (id, guild_id, name, type, updated_ms) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, type = excluded.type, updated_ms = excluded.updated_ms`,
    ).run(channel.id, channel.guildId, channel.name, channel.type, nowMs);
    logName(db, 'channel', channel.id, channel.guildId, channel.name, previous?.name, nowMs);
  })();
}

/** The global username of a person. */
export function upsertUser(db: Db, id: string, name: string, nowMs: number): void {
  db.transaction(() => {
    const previous = db.prepare('SELECT name FROM users WHERE id = ?').get(id) as { name: string } | undefined;
    db.prepare(
      `INSERT INTO users (id, name, updated_ms) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_ms = excluded.updated_ms`,
    ).run(id, name, nowMs);
    logName(db, 'user', id, null, name, previous?.name, nowMs);
  })();
}

/** The name a person shows on one server (nickname, else global display name, else username). */
export function upsertMember(db: Db, guildId: string, userId: string, displayName: string, isBot: boolean, nowMs: number): void {
  db.transaction(() => {
    const previous = db.prepare('SELECT display_name FROM members WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as
      | { display_name: string }
      | undefined;
    db.prepare(
      `INSERT INTO members (guild_id, user_id, display_name, is_bot, updated_ms) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET display_name = excluded.display_name, is_bot = excluded.is_bot, updated_ms = excluded.updated_ms`,
    ).run(guildId, userId, displayName, isBot ? 1 : 0, nowMs);
    logName(db, 'member', userId, guildId, displayName, previous?.display_name, nowMs);
  })();
}
