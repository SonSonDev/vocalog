import { deriveSessions } from '@vocalog/shared';
import type { VoiceEvent } from '@vocalog/shared';
import { describe, expect, it } from 'vitest';
import { migrate, openDb } from './db.ts';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { insertEvent, lastHeartbeat, loadEvents, recordHeartbeat, upsertChannel, upsertGuild, upsertMember, upsertUser } from './store.ts';

const event = (userId: string, channelId: string | null, atMs: number, kind: VoiceEvent['kind']): VoiceEvent => ({
  guildId: 'g1',
  userId,
  channelId,
  kind,
  atMs,
  source: 'live',
  flags: 0,
});

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('migrations', () => {
  it('applies once and is idempotent', () => {
    const db = openDb(':memory:');
    expect(migrate(db)).toEqual(['001_init.sql', '002_names_and_afk.sql', '003_user_avatar.sql']);
    expect(migrate(db)).toEqual([]);
  });
});

describe('event journal', () => {
  it('stores events and reads them back in order, ready for session derivation', () => {
    const db = freshDb();
    insertEvent(db, event('a', null, 400, 'leave'), { n: 2 });
    insertEvent(db, event('a', 'c1', 100, 'join'), { n: 1 });
    const events = loadEvents(db);
    expect(events.map((e) => e.atMs)).toEqual([100, 400]);
    expect(deriveSessions(events)).toEqual([{ guildId: 'g1', userId: 'a', channelId: 'c1', startMs: 100, endMs: 400 }]);
  });

  it('keeps the raw JSON next to the normalised columns', () => {
    const db = freshDb();
    insertEvent(db, event('a', 'c1', 100, 'join'), { hello: 'world' });
    const row = db.prepare('SELECT raw_json FROM voice_events').get() as { raw_json: string };
    expect(JSON.parse(row.raw_json)).toEqual({ hello: 'world' });
  });

  it('refuses to update an event (append-only)', () => {
    const db = freshDb();
    insertEvent(db, event('a', 'c1', 100, 'join'), {});
    expect(() => db.prepare('UPDATE voice_events SET at_ms = 1').run()).toThrow(/append-only/);
  });

  it('rejects an unknown event kind', () => {
    const db = freshDb();
    expect(() =>
      db
        .prepare("INSERT INTO voice_events (guild_id, user_id, kind, at_ms, source, raw_json) VALUES ('g','u','bogus',1,'live','{}')")
        .run(),
    ).toThrow();
  });
});

describe('heartbeats', () => {
  it('returns null when empty and the latest otherwise', () => {
    const db = freshDb();
    expect(lastHeartbeat(db)).toBeNull();
    recordHeartbeat(db, 100);
    recordHeartbeat(db, 200);
    recordHeartbeat(db, 200);
    expect(lastHeartbeat(db)).toBe(200);
  });
});

describe('names and AFK', () => {
  const history = (db: ReturnType<typeof freshDb>, kind: string, id: string) =>
    (db.prepare('SELECT name FROM name_history WHERE kind = ? AND entity_id = ? ORDER BY at_ms, rowid').all(kind, id) as { name: string }[]).map(
      (row) => row.name,
    );

  it('stores the AFK channel of a server and keeps the history of its name', () => {
    const db = freshDb();
    upsertGuild(db, { id: 'g1', name: 'First', afkChannelId: 'afk1' }, 100);
    upsertGuild(db, { id: 'g1', name: 'First', afkChannelId: 'afk2' }, 200); // same name: no new history
    upsertGuild(db, { id: 'g1', name: 'Second', afkChannelId: 'afk2' }, 300);
    const row = db.prepare('SELECT name, afk_channel_id FROM guilds WHERE id = ?').get('g1') as { name: string; afk_channel_id: string };
    expect(row).toEqual({ name: 'Second', afk_channel_id: 'afk2' });
    expect(history(db, 'guild', 'g1')).toEqual(['First', 'Second']);
  });

  it('stores the channel type and its renames', () => {
    const db = freshDb();
    upsertChannel(db, { id: 'c1', guildId: 'g1', name: 'General', type: 2 }, 100);
    upsertChannel(db, { id: 'c1', guildId: 'g1', name: 'Lounge', type: 2 }, 200);
    const row = db.prepare('SELECT name, type FROM channels WHERE id = ?').get('c1') as { name: string; type: number };
    expect(row).toEqual({ name: 'Lounge', type: 2 });
    expect(history(db, 'channel', 'c1')).toEqual(['General', 'Lounge']);
  });

  it('stores the name shown on each server separately from the username', () => {
    const db = freshDb();
    upsertUser(db, 'u1', 'alex_42', 100);
    upsertMember(db, 'g1', 'u1', 'Alex', false, 100);
    upsertMember(db, 'g2', 'u1', 'Le Alex', false, 100);
    upsertMember(db, 'g1', 'u1', 'Alexandre', false, 200);
    const rows = db.prepare('SELECT guild_id, display_name FROM members WHERE user_id = ? ORDER BY guild_id').all('u1');
    expect(rows).toEqual([
      { guild_id: 'g1', display_name: 'Alexandre' },
      { guild_id: 'g2', display_name: 'Le Alex' },
    ]);
    expect(history(db, 'member', 'u1')).toEqual(['Alex', 'Le Alex', 'Alexandre']);
    expect(history(db, 'user', 'u1')).toEqual(['alex_42']);
  });

  it('keeps the avatar hash of a person and follows its changes', () => {
    const db = freshDb();
    upsertUser(db, 'u1', 'alex_42', 100, 'abc123');
    expect(db.prepare('SELECT avatar FROM users WHERE id = ?').get('u1')).toEqual({ avatar: 'abc123' });
    upsertUser(db, 'u1', 'alex_42', 200, 'def456');
    expect(db.prepare('SELECT avatar FROM users WHERE id = ?').get('u1')).toEqual({ avatar: 'def456' });
    upsertUser(db, 'u2', 'sam', 100);
    expect(db.prepare('SELECT avatar FROM users WHERE id = ?').get('u2')).toEqual({ avatar: null });
  });

  it('adds the avatar column to a database made by the previous schema, keeping its rows', () => {
    const db = openDb(':memory:');
    const dir = join(import.meta.dirname, '..', '..', 'db', 'migrations');
    // Apply only the first two migrations, as the deployed database has them, with a person already stored.
    const old = mkdtempSync(join(tmpdir(), 'vocalog-migrations-'));
    for (const file of ['001_init.sql', '002_names_and_afk.sql']) copyFileSync(join(dir, file), join(old, file));
    migrate(db, old);
    rmSync(old, { recursive: true, force: true });
    db.prepare("INSERT INTO users (id, name, updated_ms) VALUES ('u1', 'alex_42', 1)").run();
    expect(migrate(db)).toEqual(['003_user_avatar.sql']);
    expect(db.prepare('SELECT id, name, avatar FROM users').all()).toEqual([{ id: 'u1', name: 'alex_42', avatar: null }]);
  });

  it('applies on top of an existing database without losing events', () => {
    const db = openDb(':memory:');
    migrate(db, join(import.meta.dirname, '..', '..', 'db', 'migrations'));
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()).toEqual({ n: 3 });
  });
});
