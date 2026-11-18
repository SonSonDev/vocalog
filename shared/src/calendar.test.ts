import { describe, expect, it } from 'vitest';
import { addMonths, buildMonthCalendar, buildWeekTimeline, daysInMonth, isMondayKey, isMonthKey, mondayOf, monthOf, monthStrips, weekStrips, weekWindow } from './calendar.ts';
import type { Session } from './types.ts';

const HOUR = 3_600_000;
const s = (userId: string, channelId: string, startMs: number, endMs: number | null): Session => ({ guildId: 'g', userId, channelId, startMs, endMs });
const at = (month: number, day: number, hour = 0) => Date.UTC(2026, month - 1, day, hour);

describe('week and month keys', () => {
  it('finds the Monday of a week, across a month and a year', () => {
    expect(mondayOf('2026-11-15')).toBe('2026-11-09'); // a Sunday
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });

  it('accepts only real Mondays and real months', () => {
    expect(isMondayKey('2026-11-09')).toBe(true);
    for (const bad of ['2026-11-10', '2026-02-30', '', '2026-11', '../x']) expect(isMondayKey(bad)).toBe(false);
    expect(isMonthKey('2026-11')).toBe(true);
    for (const bad of ['2026-13', '2026-00', '2026-1', '2026-11-01', '']) expect(isMonthKey(bad)).toBe(false);
  });

  it('moves between months and counts their days', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-11-15')).toBe('2026-11');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-11')).toBe(30);
  });

  it('lasts 168 hours, and 167 or 169 around a daylight saving change (Paris)', () => {
    const hours = (monday: string) => {
      const { startMs, endMs } = weekWindow(monday, 'Europe/Paris');
      return (endMs - startMs) / HOUR;
    };
    expect(hours('2026-11-09')).toBe(168);
    expect(hours('2026-03-23')).toBe(167);
    expect(hours('2026-10-19')).toBe(169);
  });
});

describe('weekStrips', () => {
  const now = at(11, 18, 12);
  const input = { fromMs: at(11, 1), limitMs: now, nowMs: now, timeZone: 'UTC', max: 12 };

  it('gives one strip per week, newest first, with the total of each day', () => {
    const sessions = [s('a', 'c', at(11, 10, 20), at(11, 10, 22)), s('b', 'c', at(11, 10, 21), at(11, 10, 23)), s('a', 'c', at(11, 14, 20), at(11, 14, 21))];
    const strips = weekStrips(sessions, input);
    expect(strips.map((strip) => strip.mondayKey)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-26']);
    const week = strips.find((strip) => strip.mondayKey === '2026-11-09')!;
    expect(week.totalMs).toBe(5 * HOUR);
    expect(week.people).toBe(2);
    expect(week.peak).toBe(2);
    expect(week.dayTotals).toEqual([0, 4 * HOUR, 0, 0, 0, HOUR, 0].map((value, index) => (index === 1 ? 4 * HOUR : value)));
    expect(week.bins).toHaveLength(168);
  });

  it('keeps an evening that passes midnight on the day it started', () => {
    const week = weekStrips([s('a', 'c', at(11, 15, 22), at(11, 16, 2))], input).find((strip) => strip.mondayKey === '2026-11-09')!;
    expect(week.dayTotals[6]).toBe(4 * HOUR); // Sunday evening, not Monday
    const next = weekStrips([s('a', 'c', at(11, 15, 22), at(11, 16, 2))], input).find((strip) => strip.mondayKey === '2026-11-16')!;
    expect(next.totalMs).toBe(0);
  });

  it('caps the count and returns nothing for an empty window', () => {
    expect(weekStrips([], { ...input, max: 2 })).toHaveLength(2);
    expect(weekStrips([], { ...input, limitMs: input.fromMs })).toEqual([]);
  });
});

describe('monthStrips', () => {
  const now = at(11, 18, 12);
  it('gives one strip per month with a total per day', () => {
    const sessions = [s('a', 'c', at(10, 31, 20), at(10, 31, 22)), s('a', 'c', at(11, 3, 20), at(11, 3, 21))];
    const strips = monthStrips(sessions, { fromMs: at(10, 1, 6), limitMs: now, nowMs: now, timeZone: 'UTC', max: 12 });
    expect(strips.map((strip) => strip.monthKey)).toEqual(['2026-11', '2026-10']);
    expect(strips[0]!.dayTotals).toHaveLength(30);
    expect(strips[0]!.dayTotals[2]).toBe(HOUR);
    expect(strips[1]!.dayTotals).toHaveLength(31);
    expect(strips[1]!.dayTotals[30]).toBe(2 * HOUR);
    expect(strips[1]!.totalMs).toBe(2 * HOUR);
  });
});

describe('buildWeekTimeline', () => {
  const now = at(11, 20);
  it('lists members by time, with spans that are not cut at the change of day', () => {
    const result = buildWeekTimeline(
      [s('small', 'c1', at(11, 11, 20), at(11, 11, 21)), s('big', 'c1', at(11, 14, 22), at(11, 15, 3)), s('big', 'c2', at(11, 10, 20), at(11, 10, 22))],
      '2026-11-09',
      now,
      'UTC',
    );
    expect(result.members.map((member) => member.userId)).toEqual(['big', 'small']);
    expect(result.members[0]!.totalMs).toBe(7 * HOUR);
    expect(result.members[0]!.spans[1]).toEqual({ channelId: 'c1', startMs: at(11, 14, 22), endMs: at(11, 15, 3) });
    expect(result.days).toHaveLength(7);
    expect(result.days[1]).toMatchObject({ dayKey: '2026-11-10', totalMs: 2 * HOUR });
    expect(result.days[5]!.totalMs).toBe(5 * HOUR); // the late evening of Saturday, up to 03:00 on Sunday
    expect(result.totalMs).toBe(8 * HOUR);
    expect(result.bins).toHaveLength(168);
  });

  it('is empty for a week with nobody, and stops at now for the current week', () => {
    expect(buildWeekTimeline([], '2026-11-09', now, 'UTC').members).toEqual([]);
    const open = buildWeekTimeline([s('a', 'c', at(11, 19, 12), null)], '2026-11-16', at(11, 19, 15), 'UTC');
    expect(open.totalMs).toBe(3 * HOUR);
  });

  it('cuts a session that started in the week before', () => {
    const result = buildWeekTimeline([s('a', 'c', at(11, 8, 20), at(11, 9, 8))], '2026-11-09', now, 'UTC');
    expect(result.members[0]!.spans).toEqual([{ channelId: 'c', startMs: at(11, 9, 6), endMs: at(11, 9, 8) }]);
  });
});

describe('buildMonthCalendar', () => {
  const now = at(11, 18, 12);
  const sessions = [s('a', 'c', at(11, 3, 20), at(11, 3, 22)), s('b', 'c', at(11, 3, 21), at(11, 3, 23)), s('a', 'c', at(11, 14, 20), at(11, 14, 21))];

  it('lays the days out as weeks of seven, Monday first, with empty cells outside the month', () => {
    const calendar = buildMonthCalendar(sessions, '2026-11', now, 'UTC');
    expect(calendar.weeks[0]!.mondayKey).toBe('2026-10-26'); // 1 November 2026 is a Sunday: the first row is mostly October
    expect(calendar.weeks[0]!.days.filter((day) => day === null)).toHaveLength(6);
    expect(calendar.weeks[0]!.days[6]!.dayKey).toBe('2026-11-01');
    const october = buildMonthCalendar([], '2026-10', now, 'UTC');
    expect(october.weeks[0]!.mondayKey).toBe('2026-09-28');
    expect(october.weeks[0]!.days.slice(0, 3)).toEqual([null, null, null]);
    expect(october.weeks[0]!.days[3]!.dayKey).toBe('2026-10-01');
    expect(october.weeks.every((week) => week.days.length === 7)).toBe(true);
  });

  it('totals the month, finds the busiest day and counts the active days', () => {
    const calendar = buildMonthCalendar(sessions, '2026-11', now, 'UTC');
    expect(calendar.totalMs).toBe(5 * HOUR);
    expect(calendar.people).toBe(2);
    expect(calendar.activeDays).toBe(2);
    expect(calendar.busiest).toEqual({ dayKey: '2026-11-03', totalMs: 4 * HOUR });
    expect(calendar.peak?.count).toBe(2);
    const day = calendar.weeks.flatMap((week) => week.days).find((cell) => cell?.dayKey === '2026-11-03')!;
    expect(day).toMatchObject({ totalMs: 4 * HOUR, people: 2, peak: 2, future: false });
  });

  it('marks the days after now as future and gives an empty month nothing', () => {
    const calendar = buildMonthCalendar(sessions, '2026-11', now, 'UTC');
    const cells = calendar.weeks.flatMap((week) => week.days).filter((cell) => cell !== null);
    expect(cells.find((cell) => cell!.dayKey === '2026-11-25')!.future).toBe(true);
    expect(cells.find((cell) => cell!.dayKey === '2026-11-17')!.future).toBe(false);
    const empty = buildMonthCalendar([], '2026-11', now, 'UTC');
    expect(empty.busiest).toBeNull();
    expect(empty.peak).toBeNull();
    expect(empty.activeDays).toBe(0);
  });
});
