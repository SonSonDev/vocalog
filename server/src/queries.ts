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

interface GuildRow {
  id: string;
  name: string;
  icon?: string | null;
}

const iconColumnSeen = new WeakSet<Db>();

/** The icon column is added by a migration the bot applies at start: until then there are no icons, never an error. */
function guildColumns(db: Db): string {
  if (!iconColumnSeen.has(db)) {
    const columns = db.prepare("SELECT name FROM pragma_table_info('guilds')").all() as { name: string }[];
    if (!columns.some((column) => column.name === 'icon')) return 'id, name';
    iconColumnSeen.add(db);
  }
  return 'id, name, icon';
}

function toGuildInfo(row: GuildRow): GuildInfo {
  return row.icon ? { id: row.id, name: row.name, icon: row.icon } : { id: row.id, name: row.name };
}

export function listGuilds(db: Db): GuildInfo[] {
  return (db.prepare(`SELECT ${guildColumns(db)} FROM guilds ORDER BY name`).all() as GuildRow[]).map(toGuildInfo);
}

export function findGuild(db: Db, guildId: string): GuildInfo | null {
  const row = db.prepare(`SELECT ${guildColumns(db)} FROM guilds WHERE id = ?`).get(guildId) as GuildRow | undefined;
  return row ? toGuildInfo(row) : null;
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

/** Discord usernames (the @handles) of everyone the bot has seen. */
export function userHandles(db: Db): Map<string, string> {
  const rows = db.prepare('SELECT id, name FROM users').all() as { id: string; name: string }[];
  return new Map(rows.map((row) => [row.id, row.name]));
}

const avatarColumnSeen = new WeakSet<Db>();

/**
 * Avatar hashes by user id. The column is added by a migration that the bot applies when it starts, and the server
 * can be updated first: until then there are simply no avatars (initials are shown), never an error.
 */
export function userAvatars(db: Db): Map<string, string> {
  if (!avatarColumnSeen.has(db)) {
    const columns = db.prepare("SELECT name FROM pragma_table_info('users')").all() as { name: string }[];
    if (!columns.some((column) => column.name === 'avatar')) return new Map();
    avatarColumnSeen.add(db);
  }
  const rows = db.prepare('SELECT id, avatar FROM users WHERE avatar IS NOT NULL').all() as { id: string; avatar: string }[];
  return new Map(rows.map((row) => [row.id, row.avatar]));
}

/** The server's AFK channel as last seen by the bot (a later change of AFK channel is not replayed on past days). */
export function afkChannelId(db: Db, guildId: string): string | null {
  const row = db.prepare('SELECT afk_channel_id FROM guilds WHERE id = ?').get(guildId) as { afk_channel_id: string | null } | undefined;
  return row?.afk_channel_id ?? null;
}

export function channelNames(db: Db, guildId: string): Map<string, string> {
  const rows = db.prepare('SELECT id, name FROM channels WHERE guild_id = ?').all(guildId) as { id: string; name: string }[];
  return new Map(rows.map((row) => [row.id, row.name]));
}
