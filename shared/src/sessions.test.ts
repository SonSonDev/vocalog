import { describe, expect, it } from 'vitest';
import { deriveSessions, durationMs, totalByUser } from './sessions.ts';
import type { VoiceEvent } from './types.ts';

const G = 'g1';
const ev = (
  userId: string,
  channelId: string | null,
  atMs: number,
  kind: VoiceEvent['kind'] = 'state',
  source: VoiceEvent['source'] = 'live',
): VoiceEvent => ({ guildId: G, userId, channelId, kind, atMs, source, flags: 0 });

describe('deriveSessions', () => {
  it('builds one closed session from a join and a leave', () => {
    const sessions = deriveSessions([ev('a', 'c1', 100, 'join'), ev('a', null, 400, 'leave')]);
    expect(sessions).toEqual([{ guildId: G, userId: 'a', channelId: 'c1', startMs: 100, endMs: 400 }]);
  });

  it('keeps a session open when there is no leave', () => {
    const sessions = deriveSessions([ev('a', 'c1', 100, 'join')]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.endMs).toBeNull();
  });

  it('splits a session on a move between channels', () => {
    const sessions = deriveSessions([
      ev('a', 'c1', 100, 'join'),
      ev('a', 'c2', 300, 'move'),
      ev('a', null, 500, 'leave'),
    ]);
    expect(sessions.map((s) => [s.channelId, s.startMs, s.endMs])).toEqual([
      ['c1', 100, 300],
      ['c2', 300, 500],
    ]);
  });

  it('does not split on state-only events in the same channel', () => {
    const sessions = deriveSessions([
      ev('a', 'c1', 100, 'join'),
      ev('a', 'c1', 200, 'state'),
      ev('a', 'c1', 250, 'state'),
      ev('a', null, 400, 'leave'),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.endMs).toBe(400);
  });

  it('ignores a leave with no open session', () => {
    expect(deriveSessions([ev('a', null, 100, 'leave')])).toEqual([]);
  });

  it('handles unsorted input', () => {
    const sessions = deriveSessions([ev('a', null, 400, 'leave'), ev('a', 'c1', 100, 'join')]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.endMs).toBe(400);
  });

  it('keeps users independent', () => {
    const sessions = deriveSessions([
      ev('a', 'c1', 100, 'join'),
      ev('b', 'c1', 150, 'join'),
      ev('a', null, 300, 'leave'),
    ]);
    expect(sessions.find((s) => s.userId === 'a')!.endMs).toBe(300);
    expect(sessions.find((s) => s.userId === 'b')!.endMs).toBeNull();
  });

  it('closes a session left open by a crash with a reconcile leave at the last heartbeat', () => {
    const sessions = deriveSessions([
      ev('a', 'c1', 100, 'join'),
      ev('a', null, 900, 'leave', 'reconcile'),
      ev('a', 'c1', 5000, 'join', 'reconcile'),
    ]);
    expect(sessions.map((s) => [s.startMs, s.endMs])).toEqual([
      [100, 900],
      [5000, null],
    ]);
  });
});

describe('durationMs and totalByUser', () => {
  it('measures an open session up to now', () => {
    expect(durationMs({ guildId: G, userId: 'a', channelId: 'c1', startMs: 100, endMs: null }, 1000)).toBe(900);
  });

  it('never returns a negative duration', () => {
    expect(durationMs({ guildId: G, userId: 'a', channelId: 'c1', startMs: 500, endMs: null }, 100)).toBe(0);
  });

  it('sums time per user across channels', () => {
    const sessions = deriveSessions([
      ev('a', 'c1', 0, 'join'),
      ev('a', 'c2', 100, 'move'),
      ev('a', null, 250, 'leave'),
      ev('b', 'c1', 0, 'join'),
      ev('b', null, 50, 'leave'),
    ]);
    const totals = totalByUser(sessions, 1000);
    expect(totals.get('a')).toBe(250);
    expect(totals.get('b')).toBe(50);
  });
});
