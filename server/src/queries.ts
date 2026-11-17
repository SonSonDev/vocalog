import { deriveSessions } from '@vocalog/shared';
import type { GuildInfo, Session, VoiceEvent } from '@vocalog/shared';
import type Database from 'better-sqlite3';

export type Db = Database.Database;
export type { GuildInfo };

interface EventRow {
  guild_id: string;
  user_id: string;
  channel_id: string | null;
  kind: VoiceEvent['kind'];
  flags: number;
  at_ms: number;
  source: VoiceEvent['source'];
}

export function listGuilds(db: Db): GuildInfo[] {
  return db.prepare('SELECT id, name FROM guilds ORDER BY name').all() as GuildInfo[];
}

export function findGuild(db: Db, guildId: string): GuildInfo | null {
  return (db.prepare('SELECT id, name FROM guilds WHERE id = ?').get(guildId) as GuildInfo | undefined) ?? null;
}

/** Events of one server in time order. */
export function loadGuildEvents(db: Db, guildId: string): VoiceEvent[] {
  const rows = db
    .prepare(
      'SELECT guild_id, user_id, channel_id, kind, flags, at_ms, source FROM voice_events WHERE guild_id = ? ORDER BY at_ms, id',
    )
    .all(guildId) as EventRow[];
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

/** Sessions of one server, derived from its events. */
export function loadGuildSessions(db: Db, guildId: string): Session[] {
  return deriveSessions(loadGuildEvents(db, guildId));
}

export function userHasEvents(db: Db, guildId: string, userId: string): boolean {
  return db.prepare('SELECT 1 FROM voice_events WHERE guild_id = ? AND user_id = ? LIMIT 1').get(guildId, userId) !== undefined;
}

export function firstEventMs(db: Db, guildId: string): number | null {
  const row = db.prepare('SELECT MIN(at_ms) AS at_ms FROM voice_events WHERE guild_id = ?').get(guildId) as { at_ms: number | null };
  return row.at_ms;
}

/** Names of people on one server: the name they show there when known, else their global username. */
export function userNames(db: Db, guildId: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of db.prepare('SELECT id, name FROM users').all() as { id: string; name: string }[]) names.set(row.id, row.name);
  for (const row of db.prepare('SELECT user_id, display_name FROM members WHERE guild_id = ?').all(guildId) as { user_id: string; display_name: string }[]) {
    names.set(row.user_id, row.display_name);
  }
  return names;
}

export function channelNames(db: Db, guildId: string): Map<string, string> {
  const rows = db.prepare('SELECT id, name FROM channels WHERE guild_id = ?').all(guildId) as { id: string; name: string }[];
  return new Map(rows.map((row) => [row.id, row.name]));
}
