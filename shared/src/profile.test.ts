import { describe, expect, it } from 'vitest';
import { activityBuckets, averageMinute, buildMemberStats, partsOfDay, roomRoles } from './profile.ts';
import { deriveSessions } from './sessions.ts';
import { VoiceFlag } from './types.ts';
import type { Session, VoiceEvent } from './types.ts';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const MON = Date.UTC(2026, 10, 16); // Monday 16 November 2026, 00:00 UTC

const ev = (userId: string, channelId: string | null, atMs: number, flags = 0, kind: VoiceEvent['kind'] = 'state'): VoiceEvent => ({
  guildId: 'g1',
  userId,
  channelId,
  kind,
  atMs,
  source: 'live',
  flags,
});

const s = (userId: string, channelId: string, startMs: number, endMs: number | null): Session => ({
  guildId: 'g1',
  userId,
  channelId,
  startMs,
  endMs,
});

const week = (extra: Partial<Parameters<typeof buildMemberStats>[0]['options']> = {}) => ({
  fromMs: MON,
  toMs: MON + 7 * DAY,
  nowMs: MON + 7 * DAY,
  timeZone: 'UTC',
  ...extra,
});

/**
 * Monday: a is in c1 from 20:00 to 23:00 (muted 21:00-22:00, streaming 22:00-23:00);
 * b is in c1 from 21:00 to 22:00. Tuesday: c is alone in c2 from 02:00 to 04:00.
 */
function scenario() {
  const events = [
    ev('a', 'c1', MON + 20 * HOUR, 0, 'join'),
    ev('a', 'c1', MON + 21 * HOUR, VoiceFlag.SelfMute),
    ev('b', 'c1', MON + 21 * HOUR, 0, 'join'),
    ev('a', 'c1', MON + 22 * HOUR, VoiceFlag.Streaming),
    ev('b', null, MON + 22 * HOUR, 0, 'leave'),
    ev('a', null, MON + 23 * HOUR, 0, 'leave'),
    ev('c', 'c2', MON + DAY + 2 * HOUR, 0, 'join'),
    ev('c', null, MON + DAY + 4 * HOUR, 0, 'leave'),
  ];
  return { events, sessions: deriveSessions(events) };
}

describe('buildMemberStats basics', () => {
  it('computes totals, sessions and the longest session', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.totalMs).toBe(3 * HOUR);
    expect(stats.sessions).toBe(1);
    expect(stats.avgSessionMs).toBe(3 * HOUR);
    expect(stats.longestSession).toEqual({ channelId: 'c1', startMs: MON + 20 * HOUR, durationMs: 3 * HOUR });
    expect(stats.days).toBe(7);
  });

  it('puts the time on the right hours and weekday', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect([stats.hourMs[20], stats.hourMs[21], stats.hourMs[22]]).toEqual([HOUR, HOUR, HOUR]);
    expect(stats.heat[0]![21]).toBe(HOUR);
  });

  it('returns zeros and no rank for a user who was never in voice', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'nobody', options: week() });
    expect(stats.totalMs).toBe(0);
    expect(stats.longestSession).toBeNull();
    expect(stats.group.rank).toBeNull();
    expect(stats.habits.avgArrivalMinute).toBeNull();
    expect(stats.together.top).toEqual([]);
    expect(stats.voiceStates.voiceMs).toBe(0);
  });
});

describe('buildMemberStats together and voice states', () => {
  it('splits time with others and alone, and ranks friends', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.together.withOthersMs).toBe(HOUR);
    expect(stats.together.aloneMs).toBe(2 * HOUR);
    expect(stats.together.top).toEqual([{ userId: 'b', ms: HOUR }]);
  });

  it('measures muted and streaming time from the journal', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.voiceStates.mutedMs).toBe(HOUR);
    expect(stats.voiceStates.streamingMs).toBe(HOUR);
    expect(stats.voiceStates.voiceMs).toBe(3 * HOUR);
  });
});

describe('buildMemberStats habits', () => {
  it('averages the arrival and departure times of day', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.habits.avgArrivalMinute).toBe(20 * 60);
    expect(stats.habits.avgDepartureMinute).toBe(23 * 60);
  });

  it('splits time into parts of the day', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.habits.partsOfDay).toEqual({ morningMs: 0, afternoonMs: 0, eveningMs: 3 * HOUR, nightMs: 0 });
  });

  it('reports the change against the previous window of the same length', () => {
    const sessions = [s('a', 'c1', MON - 3 * DAY, MON - 3 * DAY + 2 * HOUR), s('a', 'c1', MON + HOUR, MON + 4 * HOUR)];
    const stats = buildMemberStats({ sessions, events: [], userId: 'a', options: week() });
    expect(stats.habits.previousTotalMs).toBe(2 * HOUR);
    expect(stats.habits.changePercent).toBe(50);
  });

  it('gives no change figure when there is no previous activity', () => {
    const { events, sessions } = scenario();
    expect(buildMemberStats({ sessions, events, userId: 'a', options: week() }).habits.changePercent).toBeNull();
  });
});

describe('buildMemberStats room roles, streaks and late nights', () => {
  it('counts opening and closing a channel', () => {
    const { events, sessions } = scenario();
    const a = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    const b = buildMemberStats({ sessions, events, userId: 'b', options: week() });
    expect(a.roomRoles).toEqual({ opened: 1, closed: 1 }); // first in, and last out (b left earlier)
    expect(b.roomRoles).toEqual({ opened: 0, closed: 0 }); // joined a busy room, left while a stayed
  });

  it('counts a session that includes the 03:00 hour as a late session', () => {
    const { events, sessions } = scenario();
    expect(buildMemberStats({ sessions, events, userId: 'c', options: week() }).lateSessions).toBe(1);
    expect(buildMemberStats({ sessions, events, userId: 'a', options: week() }).lateSessions).toBe(0);
  });

  it('computes the best streak ignoring the window', () => {
    const sessions = [0, 1, 2, 5].map((d) => s('a', 'c1', MON - 30 * DAY + d * DAY + 10 * HOUR, MON - 30 * DAY + d * DAY + 11 * HOUR));
    const stats = buildMemberStats({ sessions, events: [], userId: 'a', options: week() });
    expect(stats.streak.best).toBe(3);
    expect(stats.streak.current).toBe(0);
  });
});

describe('buildMemberStats group comparison', () => {
  it('ranks the member and averages the group', () => {
    const { events, sessions } = scenario();
    const stats = buildMemberStats({ sessions, events, userId: 'a', options: week() });
    expect(stats.group.rank).toBe(1);
    expect(stats.group.of).toBe(3);
    expect(stats.group.avgMemberTotalMs).toBe(2 * HOUR); // 6h in total over 3 members
    expect(stats.group.mutedShare).toBeCloseTo(1 / 6, 5); // a muted 1h out of 6h of group voice time
  });
});

describe('activityBuckets', () => {
  it('fills one bucket per day, with zeros for empty days', () => {
    const { granularity, buckets } = activityBuckets([s('a', 'c1', MON + 20 * HOUR, MON + 23 * HOUR)], 'UTC', MON, MON + 7 * DAY);
    expect(granularity).toBe('day');
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toEqual({ startKey: '2026-11-16', ms: 3 * HOUR });
    expect(buckets.slice(1).every((bucket) => bucket.ms === 0)).toBe(true);
  });

  it('splits a session over midnight into two days', () => {
    const { buckets } = activityBuckets([s('a', 'c1', MON + 23 * HOUR, MON + DAY + HOUR)], 'UTC', MON, MON + 7 * DAY);
    expect([buckets[0]!.ms, buckets[1]!.ms]).toEqual([HOUR, HOUR]);
  });

  it('switches to weeks for a long window and keeps the total', () => {
    const sessions = [s('a', 'c1', MON + 10 * HOUR, MON + 12 * HOUR), s('a', 'c1', MON + 40 * DAY, MON + 40 * DAY + 3 * HOUR)];
    const { granularity, buckets } = activityBuckets(sessions, 'UTC', MON, MON + 120 * DAY);
    expect(granularity).toBe('week');
    expect(buckets[0]!.startKey).toBe('2026-11-16'); // a Monday
    expect(buckets.reduce((sum, bucket) => sum + bucket.ms, 0)).toBe(5 * HOUR);
  });
});

describe('small helpers', () => {
  it('averages times across midnight sensibly', () => {
    expect(averageMinute([23 * 60, 1 * 60])).toBe(0); // 23:00 and 01:00 average to midnight
    expect(averageMinute([20 * 60, 22 * 60])).toBe(21 * 60);
    expect(averageMinute([])).toBeNull();
  });

  it('groups hours into parts of the day', () => {
    const hours = new Array<number>(24).fill(0);
    hours[7] = 1;
    hours[13] = 2;
    hours[20] = 3;
    hours[2] = 4;
    expect(partsOfDay(hours)).toEqual({ morningMs: 1, afternoonMs: 2, eveningMs: 3, nightMs: 4 });
  });

  it('treats a solo session as both opened and closed', () => {
    expect(roomRoles([s('a', 'c1', MON, MON + HOUR)], 'a', MON, MON + DAY, MON + DAY)).toEqual({ opened: 1, closed: 1 });
  });

  it('does not count a still-open session as closed', () => {
    expect(roomRoles([s('a', 'c1', MON, null)], 'a', MON, MON + DAY, MON + DAY).closed).toBe(0);
  });

  it('counts the minute precisely', () => {
    expect(averageMinute([20 * 60 + 30, 20 * 60 + 40])).toBe(20 * 60 + 35);
    expect(MIN).toBe(60_000);
  });
});
