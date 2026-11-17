import { deriveSessions } from '@vocalog/shared';
import type { VoiceEvent } from '@vocalog/shared';
import { describe, expect, it } from 'vitest';
import { migrate, openDb } from './db.ts';
import { insertEvent, lastHeartbeat, loadEvents, recordHeartbeat } from './store.ts';

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
    expect(migrate(db)).toEqual(['001_init.sql']);
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
