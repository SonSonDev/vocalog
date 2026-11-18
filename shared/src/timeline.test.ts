import { describe, expect, it } from 'vitest';
import { buildDayTimeline, dayStrips, isDayKey, presenceBins, timelineDayKey, timelineDayWindow, zonedTime } from './timeline.ts';
import type { Session } from './types.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const PARIS = 'Europe/Paris';

const s = (userId: string, channelId: string, startMs: number, endMs: number | null): Session => ({ guildId: 'g', userId, channelId, startMs, endMs });

describe('zonedTime', () => {
  it('converts a Paris wall-clock time in winter and in summer', () => {
    expect(zonedTime('2026-01-15', 6, 0, PARIS)).toBe(Date.UTC(2026, 0, 15, 5, 0));
    expect(zonedTime('2026-07-15', 6, 0, PARIS)).toBe(Date.UTC(2026, 6, 15, 4, 0));
  });

  it('is exact around the two daylight saving changes', () => {
    expect(zonedTime('2026-03-29', 6, 0, PARIS)).toBe(Date.UTC(2026, 2, 29, 4, 0)); // clocks went forward at 02:00
    expect(zonedTime('2026-10-25', 6, 0, PARIS)).toBe(Date.UTC(2026, 9, 25, 5, 0)); // clocks went back at 03:00
  });

  it('works in UTC', () => {
    expect(zonedTime('2026-11-17', 6, 30, 'UTC')).toBe(Date.UTC(2026, 10, 17, 6, 30));
  });
});

describe('timeline day', () => {
  it('belongs to the day that started at 06:00, so after midnight is still the evening before', () => {
    expect(timelineDayKey(Date.UTC(2026, 10, 17, 23, 30), 'UTC')).toBe('2026-11-17');
    expect(timelineDayKey(Date.UTC(2026, 10, 18, 1, 0), 'UTC')).toBe('2026-11-17');
    expect(timelineDayKey(Date.UTC(2026, 10, 18, 6, 0), 'UTC')).toBe('2026-11-18');
  });

  it('lasts 24 hours, and 23 or 25 on the daylight saving days', () => {
    const length = (key: string) => {
      const { startMs, endMs } = timelineDayWindow(key, PARIS);
      return (endMs - startMs) / HOUR;
    };
    expect(length('2026-11-17')).toBe(24);
    expect(length('2026-03-28')).toBe(23);
    expect(length('2026-10-24')).toBe(25);
  });

  it('accepts only real dates', () => {
    expect(isDayKey('2026-11-17')).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '17-11-2026', '2026-11-1', '', '2026-11-17x', '../etc']) expect(isDayKey(bad)).toBe(false);
  });
});

describe('presenceBins', () => {
  const start = Date.UTC(2026, 10, 17, 6);

  it('averages the people present in each half hour', () => {
    const bins = presenceBins([s('a', 'c', start, start + HOUR), s('b', 'c', start + 15 * MIN, start + 45 * MIN)], start, start + 2 * HOUR, 30 * MIN);
    expect(bins).toEqual([1.5, 1.5, 0, 0]);
  });

  it('keeps a session that spans bins whole', () => {
    const bins = presenceBins([s('a', 'c', start + 10 * MIN, start + 100 * MIN)], start, start + 2 * HOUR, 30 * MIN);
    expect(bins.reduce((sum, value) => sum + value * 30, 0)).toBeCloseTo(90, 5);
  });
});

describe('dayStrips', () => {
  const now = Date.UTC(2026, 10, 18, 12);
  const input = { fromMs: Date.UTC(2026, 10, 14), limitMs: now, nowMs: now, timeZone: 'UTC', maxDays: 31 };

  it('gives one strip per day, newest first, with totals, people and peak', () => {
    const sessions = [
      s('a', 'c', Date.UTC(2026, 10, 17, 20), Date.UTC(2026, 10, 17, 22)),
      s('b', 'c', Date.UTC(2026, 10, 17, 21), Date.UTC(2026, 10, 17, 23)),
    ];
    const strips = dayStrips(sessions, input);
    expect(strips[0]!.dayKey).toBe('2026-11-18');
    const evening = strips.find((strip) => strip.dayKey === '2026-11-17')!;
    expect(evening.totalMs).toBe(4 * HOUR);
    expect(evening.people).toBe(2);
    expect(evening.peak).toBe(2);
    expect(evening.bins).toHaveLength(48);
    expect(strips.find((strip) => strip.dayKey === '2026-11-16')!.totalMs).toBe(0);
  });

  it('keeps an evening that passes midnight in one day', () => {
    const strips = dayStrips([s('a', 'c', Date.UTC(2026, 10, 17, 22), Date.UTC(2026, 10, 18, 2))], input);
    expect(strips.find((strip) => strip.dayKey === '2026-11-17')!.totalMs).toBe(4 * HOUR);
    expect(strips.find((strip) => strip.dayKey === '2026-11-18')!.totalMs).toBe(0);
  });

  it('measures an open session up to now', () => {
    const strips = dayStrips([s('a', 'c', Date.UTC(2026, 10, 18, 10), null)], input);
    expect(strips[0]!.totalMs).toBe(2 * HOUR);
  });

  it('caps the number of days and returns nothing for an empty window', () => {
    expect(dayStrips([], { ...input, maxDays: 3 })).toHaveLength(3);
    expect(dayStrips([], { ...input, limitMs: input.fromMs })).toEqual([]);
  });
});

describe('buildDayTimeline', () => {
  const day = '2026-11-17';
  const t = (hour: number, minute = 0) => Date.UTC(2026, 10, 17, hour, minute);
  const now = Date.UTC(2026, 10, 20);

  it('lists members by first arrival with their spans and channels', () => {
    const result = buildDayTimeline([s('late', 'c2', t(21), t(23)), s('early', 'c1', t(19), t(20)), s('early', 'c2', t(20), t(22))], day, now, 'UTC');
    expect(result.members.map((member) => member.userId)).toEqual(['early', 'late']);
    expect(result.members[0]!.spans.map((span) => span.channelId)).toEqual(['c1', 'c2']);
    expect(result.members[0]!.totalMs).toBe(3 * HOUR);
    expect(result.totalMs).toBe(5 * HOUR);
    expect(result.peak).toEqual({ count: 2, atMs: t(21) });
    expect(result.bins).toHaveLength(96);
  });

  it('is empty for a day with nobody', () => {
    const result = buildDayTimeline([s('a', 'c', t(5), t(5, 30)), s('a', 'c', Date.UTC(2026, 10, 19, 10), Date.UTC(2026, 10, 19, 11))], day, now, 'UTC');
    expect(result.members).toEqual([]);
    expect(result.peak).toBeNull();
    expect(result.totalMs).toBe(0);
  });

  it('cuts a session that started before the day', () => {
    const result = buildDayTimeline([s('a', 'c', t(2), t(8))], day, now, 'UTC');
    expect(result.members[0]!.spans).toEqual([{ channelId: 'c', startMs: t(6), endMs: t(8) }]);
  });
});
