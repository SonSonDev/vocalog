import { describe, expect, it } from 'vitest';
import { planReconcile } from './reconcile.ts';
import type { LiveVoiceState, Session } from './types.ts';

const open = (userId: string, channelId: string, startMs: number, guildId = 'g1'): Session => ({
  guildId,
  userId,
  channelId,
  startMs,
  endMs: null,
});
const live = (userId: string, channelId: string, guildId = 'g1'): LiveVoiceState => ({
  guildId,
  userId,
  channelId,
  flags: 0,
});

describe('planReconcile', () => {
  it('does nothing when journal and live state agree', () => {
    expect(planReconcile([open('a', 'c1', 100)], [live('a', 'c1')], 900, 5000)).toEqual([]);
  });

  it('closes a vanished session at the last heartbeat, not at restart time', () => {
    const events = planReconcile([open('a', 'c1', 100)], [], 900, 5000);
    expect(events).toEqual([
      { guildId: 'g1', userId: 'a', channelId: null, kind: 'leave', atMs: 900, source: 'reconcile', flags: 0 },
    ]);
  });

  it('never closes a session before it started', () => {
    const events = planReconcile([open('a', 'c1', 1000)], [], 500, 5000);
    expect(events[0]!.atMs).toBe(1000);
  });

  it('never closes a session after now', () => {
    const events = planReconcile([open('a', 'c1', 100)], [], 9000, 5000);
    expect(events[0]!.atMs).toBe(5000);
  });

  it('uses the session start when there is no heartbeat at all', () => {
    const events = planReconcile([open('a', 'c1', 100)], [], null, 5000);
    expect(events[0]!.atMs).toBe(100);
  });

  it('opens a session for a user already in voice with no open session', () => {
    const events = planReconcile([], [live('a', 'c1')], null, 5000);
    expect(events).toEqual([
      { guildId: 'g1', userId: 'a', channelId: 'c1', kind: 'join', atMs: 5000, source: 'reconcile', flags: 0 },
    ]);
  });

  it('handles a user who changed channel during the outage', () => {
    const events = planReconcile([open('a', 'c1', 100)], [live('a', 'c2')], 900, 5000);
    expect(events.map((e) => [e.kind, e.channelId, e.atMs])).toEqual([
      ['leave', null, 900],
      ['join', 'c2', 5000],
    ]);
  });

  it('keeps guilds separate', () => {
    const events = planReconcile([open('a', 'c1', 100, 'g1')], [live('a', 'c1', 'g2')], 900, 5000);
    expect(events.map((e) => [e.guildId, e.kind])).toEqual([
      ['g1', 'leave'],
      ['g2', 'join'],
    ]);
  });
});
