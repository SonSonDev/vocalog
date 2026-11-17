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

export function upsertGuild(db: Db, id: string, name: string, nowMs: number): void {
  db.prepare(
    `INSERT INTO guilds (id, name, updated_ms) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_ms = excluded.updated_ms`,
  ).run(id, name, nowMs);
}

export function upsertChannel(db: Db, id: string, guildId: string, name: string, nowMs: number): void {
  db.prepare(
    `INSERT INTO channels (id, guild_id, name, updated_ms) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_ms = excluded.updated_ms`,
  ).run(id, guildId, name, nowMs);
}

export function upsertUser(db: Db, id: string, name: string, nowMs: number): void {
  db.prepare(
    `INSERT INTO users (id, name, updated_ms) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_ms = excluded.updated_ms`,
  ).run(id, name, nowMs);
}
