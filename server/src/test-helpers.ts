import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './queries.ts';

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'db', 'migrations');

/** A fresh in-memory database with the real schema. Test use only. */
export function testDb(): Db {
  const db = new Database(':memory:');
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  return db;
}

export function addEvent(
  db: Db,
  event: { guildId?: string; userId: string; channelId: string | null; kind: 'join' | 'leave' | 'move' | 'state'; atMs: number; flags?: number },
): void {
  db.prepare(
    `INSERT INTO voice_events (guild_id, user_id, channel_id, kind, flags, at_ms, source, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, 'live', '{}')`,
  ).run(event.guildId ?? 'g1', event.userId, event.channelId, event.kind, event.flags ?? 0, event.atMs);
}

export function addNames(db: Db): void {
  db.prepare("INSERT INTO guilds (id, name, updated_ms) VALUES ('g1', 'Test server', 0), ('g2', 'Other server', 0)").run();
  db.prepare("INSERT INTO channels (id, guild_id, name, updated_ms) VALUES ('c1', 'g1', 'General', 0), ('c2', 'g1', 'Games', 0)").run();
  db.prepare("INSERT INTO users (id, name, updated_ms) VALUES ('u1', 'Alex', 0), ('u2', 'Sam', 0)").run();
}
