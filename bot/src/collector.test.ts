import { deriveSessions } from '@vocalog/shared';
import type { VoiceEvent } from '@vocalog/shared';
import { describe, expect, it } from 'vitest';
import { reconcileJournal } from './collector.ts';
import { migrate, openDb } from './db.ts';
import { insertEvent, loadEvents, recordHeartbeat } from './store.ts';

const join = (userId: string, channelId: string, atMs: number): VoiceEvent => ({
  guildId: 'g1',
  userId,
  channelId,
  kind: 'join',
  atMs,
  source: 'live',
  flags: 0,
});

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('reconcileJournal', () => {
  it('closes a session cut short by a crash at the last heartbeat, and reopens it if the user is still there', () => {
    const db = freshDb();
    insertEvent(db, join('a', 'c1', 1000), {});
    recordHeartbeat(db, 61_000);

    const written = reconcileJournal(db, [{ guildId: 'g1', userId: 'a', channelId: 'c2', flags: 0 }], 10_000_000);
    expect(written.map((e) => [e.kind, e.atMs])).toEqual([
      ['leave', 61_000],
      ['join', 10_000_000],
    ]);

    const sessions = deriveSessions(loadEvents(db));
    expect(sessions.map((s) => [s.channelId, s.startMs, s.endMs])).toEqual([
      ['c1', 1000, 61_000],
      ['c2', 10_000_000, null],
    ]);
  });

  it('writes nothing when the journal already matches reality', () => {
    const db = freshDb();
    insertEvent(db, join('a', 'c1', 1000), {});
    const written = reconcileJournal(db, [{ guildId: 'g1', userId: 'a', channelId: 'c1', flags: 0 }], 5000);
    expect(written).toEqual([]);
    expect(loadEvents(db)).toHaveLength(1);
  });

  it('marks synthetic events with the reconcile source', () => {
    const db = freshDb();
    reconcileJournal(db, [{ guildId: 'g1', userId: 'a', channelId: 'c1', flags: 0 }], 5000);
    expect(loadEvents(db)[0]!.source).toBe('reconcile');
  });
});
