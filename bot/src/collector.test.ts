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

describe('reconcileJournal for one server', () => {
  const joinIn = (guildId: string, userId: string, channelId: string, atMs: number): VoiceEvent => ({
    guildId,
    userId,
    channelId,
    kind: 'join',
    atMs,
    source: 'live',
    flags: 0,
  });

  it('only touches the given server and leaves other open sessions alone', () => {
    const db = freshDb();
    insertEvent(db, joinIn('g1', 'a', 'c1', 1000), {});
    insertEvent(db, joinIn('g2', 'b', 'c9', 1000), {});
    // g1 was lost and came back with nobody in voice; g2 was never lost.
    const written = reconcileJournal(db, [], 100_000, { guildId: 'g1', aliveUntilMs: 5000 });
    expect(written.map((e) => [e.guildId, e.kind, e.atMs])).toEqual([['g1', 'leave', 5000]]);
    const sessions = deriveSessions(loadEvents(db));
    expect(sessions.find((s) => s.guildId === 'g2')!.endMs).toBeNull();
  });

  it('closes at the moment the loss began, not at the last heartbeat', () => {
    const db = freshDb();
    insertEvent(db, joinIn('g1', 'a', 'c1', 1000), {});
    recordHeartbeat(db, 90_000); // a heartbeat written later must not win
    const written = reconcileJournal(db, [], 100_000, { guildId: 'g1', aliveUntilMs: 20_000 });
    expect(written[0]!.atMs).toBe(20_000);
  });

  it('falls back to the last heartbeat without an explicit loss time', () => {
    const db = freshDb();
    insertEvent(db, joinIn('g1', 'a', 'c1', 1000), {});
    recordHeartbeat(db, 61_000);
    expect(reconcileJournal(db, [], 100_000, { guildId: 'g1' })[0]!.atMs).toBe(61_000);
  });

  it('ignores live users of other servers when scoped', () => {
    const db = freshDb();
    const written = reconcileJournal(db, [{ guildId: 'g2', userId: 'x', channelId: 'c', flags: 0 }], 5000, { guildId: 'g1' });
    expect(written).toEqual([]);
  });

  it('reopens a session for someone who is still in voice after the resync', () => {
    const db = freshDb();
    insertEvent(db, joinIn('g1', 'a', 'c1', 1000), {});
    const written = reconcileJournal(db, [{ guildId: 'g1', userId: 'a', channelId: 'c2', flags: 0 }], 100_000, {
      guildId: 'g1',
      aliveUntilMs: 20_000,
    });
    expect(written.map((e) => [e.kind, e.channelId, e.atMs])).toEqual([
      ['leave', null, 20_000],
      ['join', 'c2', 100_000],
    ]);
  });
});

describe('reconcileJournal with servers to leave alone', () => {
  it('does not close sessions of a server that is unavailable at start', () => {
    const db = freshDb();
    const at = (guildId: string, userId: string): VoiceEvent => ({ guildId, userId, channelId: 'c', kind: 'join', atMs: 1000, source: 'live', flags: 0 });
    insertEvent(db, at('g1', 'a'), {});
    insertEvent(db, at('g2', 'b'), {});
    const written = reconcileJournal(db, [], 100_000, { exceptGuildIds: new Set(['g2']), aliveUntilMs: 5000 });
    expect(written.map((e) => [e.guildId, e.kind])).toEqual([['g1', 'leave']]);
    expect(deriveSessions(loadEvents(db)).find((s) => s.guildId === 'g2')!.endMs).toBeNull();
  });
});
