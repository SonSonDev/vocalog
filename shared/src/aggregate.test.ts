import { describe, expect, it } from 'vitest';
import { aggregate } from './aggregate.ts';
import type { Session } from './types.ts';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
// Monday 16 November 2026, 00:00 UTC.
const MON = Date.UTC(2026, 10, 16);

const s = (userId: string, channelId: string, startMs: number, endMs: number | null): Session => ({
  guildId: 'g1',
  userId,
  channelId,
  startMs,
  endMs,
});

const opts = (extra: Partial<Parameters<typeof aggregate>[1]> = {}) => ({
  fromMs: MON,
  toMs: MON + 7 * DAY,
  nowMs: MON + 7 * DAY,
  timeZone: 'UTC',
  ...extra,
});

describe('aggregate totals', () => {
  it('sums time, sessions, members and channels', () => {
    const result = aggregate([s('a', 'c1', MON + HOUR, MON + 3 * HOUR), s('b', 'c2', MON + HOUR, MON + 2 * HOUR)], opts());
    expect(result.totalMs).toBe(3 * HOUR);
    expect(result.sessionCount).toBe(2);
    expect(result.activeMembers).toBe(2);
    expect(result.members.map((m) => [m.userId, m.totalMs])).toEqual([
      ['a', 2 * HOUR],
      ['b', HOUR],
    ]);
    expect(result.channels.map((c) => c.channelId)).toEqual(['c1', 'c2']);
  });

  it('clips sessions to the window', () => {
    const result = aggregate([s('a', 'c1', MON - HOUR, MON + HOUR)], opts());
    expect(result.totalMs).toBe(HOUR);
  });

  it('measures open sessions up to now and never past it', () => {
    const result = aggregate([s('a', 'c1', MON + HOUR, null)], opts({ nowMs: MON + 3 * HOUR }));
    expect(result.totalMs).toBe(2 * HOUR);
  });

  it('computes the average per day over the window', () => {
    const result = aggregate([s('a', 'c1', MON, MON + 7 * HOUR)], opts());
    expect(result.days).toBe(7);
    expect(result.avgPerDayMs).toBe(HOUR);
  });

  it('returns empty statistics without sessions', () => {
    const result = aggregate([], opts());
    expect(result.totalMs).toBe(0);
    expect(result.longestSession).toBeNull();
    expect(result.peak).toBeNull();
    expect(result.pairs).toEqual([]);
    expect(result.streakDays).toBe(0);
  });
});

describe('aggregate hours and weekdays', () => {
  it('fills the heatmap on the right weekday and hour in UTC', () => {
    const result = aggregate([s('a', 'c1', MON + 21 * HOUR, MON + 22 * HOUR)], opts());
    expect(result.heat[0]![21]).toBe(HOUR);
    expect(result.heat.flat().reduce((x, y) => x + y, 0)).toBe(HOUR);
  });

  it('splits a session across hours', () => {
    const result = aggregate([s('a', 'c1', MON + 20 * HOUR + 30 * MIN, MON + 22 * HOUR + 15 * MIN)], opts());
    const hours = result.members[0]!.hourMs;
    expect([hours[20], hours[21], hours[22]]).toEqual([30 * MIN, HOUR, 15 * MIN]);
  });

  it('uses the given time zone, including the change of weekday', () => {
    // 22:30 to 23:30 UTC on Monday is 23:30 Monday to 00:30 Tuesday in Paris (UTC+1 in winter).
    const result = aggregate([s('a', 'c1', MON + 22 * HOUR + 30 * MIN, MON + 23 * HOUR + 30 * MIN)], opts({ timeZone: 'Europe/Paris' }));
    expect(result.heat[0]![23]).toBe(30 * MIN);
    expect(result.heat[1]![0]).toBe(30 * MIN);
  });
});

describe('aggregate records, pairs and streak', () => {
  it('finds the longest session', () => {
    const result = aggregate([s('a', 'c1', MON, MON + HOUR), s('b', 'c2', MON + 2 * HOUR, MON + 5 * HOUR)], opts());
    expect(result.longestSession).toEqual({ userId: 'b', channelId: 'c2', startMs: MON + 2 * HOUR, durationMs: 3 * HOUR });
  });

  it('finds the peak of people in voice at once', () => {
    const result = aggregate(
      [s('a', 'c1', MON, MON + 4 * HOUR), s('b', 'c1', MON + HOUR, MON + 3 * HOUR), s('c', 'c2', MON + 2 * HOUR, MON + 2 * HOUR + 30 * MIN)],
      opts(),
    );
    expect(result.peak).toEqual({ count: 3, atMs: MON + 2 * HOUR });
  });

  it('does not count a hand-over at the same instant as an overlap', () => {
    const result = aggregate([s('a', 'c1', MON, MON + HOUR), s('b', 'c1', MON + HOUR, MON + 2 * HOUR)], opts());
    expect(result.peak!.count).toBe(1);
  });

  it('ranks pairs by time together', () => {
    const result = aggregate(
      [s('a', 'c1', MON, MON + 3 * HOUR), s('b', 'c1', MON + HOUR, MON + 3 * HOUR), s('c', 'c1', MON + 2 * HOUR, MON + 3 * HOUR)],
      opts(),
    );
    expect(result.pairs[0]).toEqual({ userA: 'a', userB: 'b', ms: 2 * HOUR });
    expect(result.pairs).toHaveLength(3);
  });

  it('counts the streak of consecutive days ending today', () => {
    const today = MON + 3 * DAY;
    const sessions = [today - 2 * DAY, today - DAY, today].map((day) => s('a', 'c1', day + 10 * HOUR, day + 11 * HOUR));
    const result = aggregate(sessions, opts({ nowMs: today + 12 * HOUR }));
    expect(result.streakDays).toBe(3);
  });

  it('keeps the streak alive when today has no one yet but yesterday had', () => {
    const today = MON + 3 * DAY;
    const sessions = [s('a', 'c1', today - DAY + 10 * HOUR, today - DAY + 11 * HOUR)];
    expect(aggregate(sessions, opts({ nowMs: today + HOUR })).streakDays).toBe(1);
  });

  it('breaks the streak after a day without anyone', () => {
    const today = MON + 5 * DAY;
    const sessions = [s('a', 'c1', today - 3 * DAY + 10 * HOUR, today - 3 * DAY + 11 * HOUR)];
    expect(aggregate(sessions, opts({ nowMs: today + HOUR })).streakDays).toBe(0);
  });
});
