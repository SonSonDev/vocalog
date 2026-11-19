import { clipSessions, dayKeyOf, dayNumber, peakOf, weekdayIndex } from './aggregate.ts';
import { isDayKey, presenceBins, timelineDayKey, timelineDayWindow } from './timeline.ts';
import type { Session, WeekStart } from './types.ts';

/*
 * Weeks and months of the timelines. A week starts on Monday (or Sunday, when asked) and, like every day of the timelines, runs from 06:00 to
 * 06:00 (so it is 167 or 169 hours around a daylight saving change). A month is the set of timeline days whose date is in
 * that month, which is what a calendar shows.
 */

const HOUR_MS = 3_600_000;

/** The first day (`YYYY-MM-DD`) of the week that contains this day: a Monday, or a Sunday when weeks start on Sunday. */
export function weekStartOf(dayKey: string, weekStart: WeekStart = 'monday'): string {
  const day = dayNumber(dayKey);
  return dayKeyOf(day - weekdayIndex(day, weekStart));
}

/** True for the date of a real first day of a week. */
export function isWeekStartKey(value: string, weekStart: WeekStart = 'monday'): boolean {
  return isDayKey(value) && weekdayIndex(dayNumber(value), weekStart) === 0;
}

/** `YYYY-MM`, with a real month. */
export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const index = year! * 12 + (month! - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate();
}

export function weekWindow(startKey: string, timeZone: string): { startMs: number; endMs: number } {
  return {
    startMs: timelineDayWindow(startKey, timeZone).startMs,
    endMs: timelineDayWindow(dayKeyOf(dayNumber(startKey) + 6), timeZone).endMs,
  };
}

function monthWindow(monthKey: string, timeZone: string): { startMs: number; endMs: number } {
  return {
    startMs: timelineDayWindow(`${monthKey}-01`, timeZone).startMs,
    endMs: timelineDayWindow(`${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`, timeZone).endMs,
  };
}

const sumMs = (clipped: readonly Session[]): number => clipped.reduce((sum, session) => sum + (session.endMs! - session.startMs), 0);

/** Voice time of everybody in one timeline day. */
function dayTotal(sessions: readonly Session[], dayKey: string, limitMs: number, nowMs: number, timeZone: string): number {
  const { startMs, endMs } = timelineDayWindow(dayKey, timeZone);
  return sumMs(clipSessions(sessions, startMs, Math.min(endMs, limitMs), nowMs));
}

export interface WeekStrip {
  startKey: string;
  startMs: number;
  endMs: number;
  totalMs: number;
  people: number;
  /** Most people at once. */
  peak: number;
  /** Voice time of everybody on each of the seven days, the first day of the week first. */
  dayTotals: number[];
  /** Average number of people in each hour from the start of the week. */
  bins: number[];
}

export interface PeriodInput {
  /** The day weeks start on, for the strips of weeks. Monday when absent. */
  weekStart?: WeekStart;
  fromMs: number;
  /** End of the window; never later than `nowMs`. */
  limitMs: number;
  nowMs: number;
  timeZone: string;
  /** At most this many weeks or months, newest first. */
  max: number;
}

/** One strip per week of the window, newest first. */
export function weekStrips(sessions: readonly Session[], input: PeriodInput): WeekStrip[] {
  const { fromMs, limitMs, nowMs, timeZone, max, weekStart = 'monday' } = input;
  if (limitMs <= fromMs) return [];
  const first = dayNumber(weekStartOf(timelineDayKey(fromMs, timeZone), weekStart));
  const last = dayNumber(weekStartOf(timelineDayKey(limitMs - 1, timeZone), weekStart));
  const strips: WeekStrip[] = [];
  for (let monday = last; monday >= first && strips.length < max; monday -= 7) {
    const startKey = dayKeyOf(monday);
    const { startMs, endMs } = weekWindow(startKey, timeZone);
    const clipped = clipSessions(sessions, startMs, Math.min(endMs, limitMs), nowMs);
    strips.push({
      startKey,
      startMs,
      endMs,
      totalMs: sumMs(clipped),
      people: new Set(clipped.map((session) => session.userId)).size,
      peak: peakOf(clipped)?.count ?? 0,
      dayTotals: Array.from({ length: 7 }, (_, offset) => dayTotal(sessions, dayKeyOf(monday + offset), limitMs, nowMs, timeZone)),
      bins: presenceBins(clipped, startMs, endMs, HOUR_MS),
    });
  }
  return strips;
}

export interface MonthStrip {
  monthKey: string;
  totalMs: number;
  people: number;
  peak: number;
  /** Voice time of everybody on each day of the month, the 1st first. */
  dayTotals: number[];
}

/** One strip per month of the window, newest first. */
export function monthStrips(sessions: readonly Session[], input: PeriodInput): MonthStrip[] {
  const { fromMs, limitMs, nowMs, timeZone, max } = input;
  if (limitMs <= fromMs) return [];
  const first = monthOf(timelineDayKey(fromMs, timeZone));
  const last = monthOf(timelineDayKey(limitMs - 1, timeZone));
  const strips: MonthStrip[] = [];
  for (let month = last; month >= first && strips.length < max; month = addMonths(month, -1)) {
    const { startMs, endMs } = monthWindow(month, timeZone);
    const clipped = clipSessions(sessions, startMs, Math.min(endMs, limitMs), nowMs);
    strips.push({
      monthKey: month,
      totalMs: sumMs(clipped),
      people: new Set(clipped.map((session) => session.userId)).size,
      peak: peakOf(clipped)?.count ?? 0,
      dayTotals: Array.from({ length: daysInMonth(month) }, (_, index) => dayTotal(sessions, `${month}-${String(index + 1).padStart(2, '0')}`, limitMs, nowMs, timeZone)),
    });
  }
  return strips;
}

export interface WeekTimeline {
  startKey: string;
  startMs: number;
  endMs: number;
  /** The seven days with their own window and voice time. */
  days: { dayKey: string; startMs: number; endMs: number; totalMs: number }[];
  totalMs: number;
  peak: { count: number; atMs: number } | null;
  /** Average number of people in each hour from the start of the week. */
  bins: number[];
  /** Who was in voice that week, most time first. A stay is not cut at the change of day. */
  members: { userId: string; totalMs: number; spans: { channelId: string; startMs: number; endMs: number }[] }[];
}

/** Everything that happened in one week, sessions clipped to it (an open session ends at `nowMs`). */
export function buildWeekTimeline(sessions: readonly Session[], startKey: string, nowMs: number, timeZone: string): WeekTimeline {
  const { startMs, endMs } = weekWindow(startKey, timeZone);
  const limit = Math.min(endMs, nowMs);
  const clipped = clipSessions(sessions, startMs, limit, nowMs);
  const byUser = new Map<string, WeekTimeline['members'][number]>();
  for (const session of clipped) {
    let member = byUser.get(session.userId);
    if (!member) {
      member = { userId: session.userId, totalMs: 0, spans: [] };
      byUser.set(session.userId, member);
    }
    member.totalMs += session.endMs! - session.startMs;
    member.spans.push({ channelId: session.channelId, startMs: session.startMs, endMs: session.endMs! });
  }
  const members = [...byUser.values()].map((member) => ({ ...member, spans: member.spans.sort((a, b) => a.startMs - b.startMs) }));
  members.sort((a, b) => b.totalMs - a.totalMs || a.userId.localeCompare(b.userId));
  return {
    startKey,
    startMs,
    endMs,
    days: Array.from({ length: 7 }, (_, offset) => {
      const dayKey = dayKeyOf(dayNumber(startKey) + offset);
      return { dayKey, ...timelineDayWindow(dayKey, timeZone), totalMs: dayTotal(sessions, dayKey, limit, nowMs, timeZone) };
    }),
    totalMs: sumMs(clipped),
    peak: peakOf(clipped),
    bins: presenceBins(clipped, startMs, endMs, HOUR_MS),
    members,
  };
}

export interface CalendarDay {
  dayKey: string;
  totalMs: number;
  people: number;
  peak: number;
  /** After now: nothing can have happened yet. */
  future: boolean;
}

export interface MonthCalendar {
  monthKey: string;
  totalMs: number;
  people: number;
  /** Days with somebody in voice. */
  activeDays: number;
  busiest: { dayKey: string; totalMs: number } | null;
  peak: { count: number; atMs: number } | null;
  /** Weeks as rows, the first day of the week first; a day outside the month is null. */
  weeks: { startKey: string; days: (CalendarDay | null)[] }[];
}

/** A month as a calendar: one cell per day with the voice time of the group. */
export function buildMonthCalendar(sessions: readonly Session[], monthKey: string, nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): MonthCalendar {
  const { startMs, endMs } = monthWindow(monthKey, timeZone);
  const clipped = clipSessions(sessions, startMs, Math.min(endMs, nowMs), nowMs);

  const days: CalendarDay[] = Array.from({ length: daysInMonth(monthKey) }, (_, index) => {
    const dayKey = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
    const window = timelineDayWindow(dayKey, timeZone);
    const inDay = clipSessions(sessions, window.startMs, Math.min(window.endMs, nowMs), nowMs);
    return {
      dayKey,
      totalMs: sumMs(inDay),
      people: new Set(inDay.map((session) => session.userId)).size,
      peak: peakOf(inDay)?.count ?? 0,
      future: window.startMs > nowMs,
    };
  });

  const active = days.filter((day) => day.totalMs > 0);
  const busiest = active.reduce<CalendarDay | null>((best, day) => (best === null || day.totalMs > best.totalMs ? day : best), null);

  const weeks: MonthCalendar['weeks'] = [];
  const firstMonday = dayNumber(weekStartOf(days[0]!.dayKey, weekStart));
  const byKey = new Map(days.map((day) => [day.dayKey, day]));
  for (let monday = firstMonday; monday <= dayNumber(days[days.length - 1]!.dayKey); monday += 7) {
    weeks.push({ startKey: dayKeyOf(monday), days: Array.from({ length: 7 }, (_, offset) => byKey.get(dayKeyOf(monday + offset)) ?? null) });
  }

  return {
    monthKey,
    totalMs: sumMs(clipped),
    people: new Set(clipped.map((session) => session.userId)).size,
    activeDays: active.length,
    busiest: busiest ? { dayKey: busiest.dayKey, totalMs: busiest.totalMs } : null,
    peak: peakOf(clipped),
    weeks,
  };
}

/* ---- Years ---- */

/** `YYYY`, a plausible year. */
export function isYearKey(value: string): boolean {
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;
}

export function yearOf(dayKey: string): string {
  return dayKey.slice(0, 4);
}

function yearWindow(yearKey: string, timeZone: string): { startMs: number; endMs: number } {
  return { startMs: timelineDayWindow(`${yearKey}-01-01`, timeZone).startMs, endMs: timelineDayWindow(`${yearKey}-12-31`, timeZone).endMs };
}

/** Voice time of everybody on each of `dayCount` consecutive timeline days, in one pass over the (already clipped) sessions. */
function totalsPerDay(clipped: readonly Session[], firstDay: number, dayCount: number, timeZone: string): number[] {
  const totals = new Array<number>(dayCount).fill(0);
  const windows = Array.from({ length: dayCount }, (_, index) => timelineDayWindow(dayKeyOf(firstDay + index), timeZone));
  for (const session of clipped) {
    const end = session.endMs!;
    // The windows follow one another: find the first one that ends after the stay starts.
    let low = 0;
    let high = dayCount - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (windows[middle]!.endMs > session.startMs) high = middle;
      else low = middle + 1;
    }
    for (let index = low; index < dayCount && windows[index]!.startMs < end; index++) {
      totals[index]! += Math.max(0, Math.min(windows[index]!.endMs, end) - Math.max(windows[index]!.startMs, session.startMs));
    }
  }
  return totals;
}

export interface YearStrip {
  yearKey: string;
  totalMs: number;
  people: number;
  peak: number;
  /** Voice time of everybody in each month, January first. */
  monthTotals: number[];
}

/** One strip per year of the window, newest first. */
export function yearStrips(sessions: readonly Session[], input: PeriodInput): YearStrip[] {
  const { fromMs, limitMs, nowMs, timeZone, max } = input;
  if (limitMs <= fromMs) return [];
  const first = Number(yearOf(timelineDayKey(fromMs, timeZone)));
  const last = Number(yearOf(timelineDayKey(limitMs - 1, timeZone)));
  const strips: YearStrip[] = [];
  for (let year = last; year >= first && strips.length < max; year--) {
    const yearKey = String(year);
    const { startMs, endMs } = yearWindow(yearKey, timeZone);
    const clipped = clipSessions(sessions, startMs, Math.min(endMs, limitMs), nowMs);
    strips.push({
      yearKey,
      totalMs: sumMs(clipped),
      people: new Set(clipped.map((session) => session.userId)).size,
      peak: peakOf(clipped)?.count ?? 0,
      monthTotals: Array.from({ length: 12 }, (_, index) => {
        const window = monthWindow(`${yearKey}-${String(index + 1).padStart(2, '0')}`, timeZone);
        return sumMs(clipSessions(clipped, window.startMs, Math.min(window.endMs, limitMs), nowMs));
      }),
    });
  }
  return strips;
}

export interface YearCalendar {
  yearKey: string;
  totalMs: number;
  people: number;
  /** Days with somebody in voice. */
  activeDays: number;
  peak: { count: number; atMs: number } | null;
  busiestDay: { dayKey: string; totalMs: number } | null;
  busiestMonth: { monthKey: string; totalMs: number } | null;
  /** The longest run of days in a row with somebody in voice. */
  longestStreak: { days: number; startKey: string; endKey: string } | null;
  months: {
    monthKey: string;
    totalMs: number;
    activeDays: number;
    /** Weekday of the 1st counted from the first day of the week (0 = Monday, or Sunday): how many empty cells come first in the grid. */
    firstWeekday: number;
    days: { dayKey: string; totalMs: number; future: boolean }[];
  }[];
}

/** A year as twelve small calendars: one cell per day with the voice time of the group. */
export function buildYearCalendar(sessions: readonly Session[], yearKey: string, nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): YearCalendar {
  const { startMs, endMs } = yearWindow(yearKey, timeZone);
  const clipped = clipSessions(sessions, startMs, Math.min(endMs, nowMs), nowMs);
  const firstDay = dayNumber(`${yearKey}-01-01`);
  const dayCount = dayNumber(`${yearKey}-12-31`) - firstDay + 1;
  const totals = totalsPerDay(clipped, firstDay, dayCount, timeZone);

  const months = Array.from({ length: 12 }, (_, index) => {
    const monthKey = `${yearKey}-${String(index + 1).padStart(2, '0')}`;
    const days = Array.from({ length: daysInMonth(monthKey) }, (_, offset) => {
      const dayKey = `${monthKey}-${String(offset + 1).padStart(2, '0')}`;
      return { dayKey, totalMs: totals[dayNumber(dayKey) - firstDay]!, future: timelineDayWindow(dayKey, timeZone).startMs > nowMs };
    });
    return {
      monthKey,
      totalMs: days.reduce((sum, day) => sum + day.totalMs, 0),
      activeDays: days.filter((day) => day.totalMs > 0).length,
      firstWeekday: weekdayIndex(dayNumber(`${monthKey}-01`), weekStart),
      days,
    };
  });

  const days = months.flatMap((month) => month.days);
  const busiestDay = days.reduce<{ dayKey: string; totalMs: number } | null>((best, day) => (day.totalMs > 0 && (best === null || day.totalMs > best.totalMs) ? { dayKey: day.dayKey, totalMs: day.totalMs } : best), null);
  const busiestMonth = months.reduce<{ monthKey: string; totalMs: number } | null>((best, month) => (month.totalMs > 0 && (best === null || month.totalMs > best.totalMs) ? { monthKey: month.monthKey, totalMs: month.totalMs } : best), null);

  let longest: YearCalendar['longestStreak'] = null;
  let runStart = -1;
  days.forEach((day, index) => {
    if (day.totalMs > 0) {
      if (runStart < 0) runStart = index;
      const length = index - runStart + 1;
      if (longest === null || length > longest.days) longest = { days: length, startKey: days[runStart]!.dayKey, endKey: day.dayKey };
    } else {
      runStart = -1;
    }
  });

  return {
    yearKey,
    totalMs: sumMs(clipped),
    people: new Set(clipped.map((session) => session.userId)).size,
    activeDays: days.filter((day) => day.totalMs > 0).length,
    peak: peakOf(clipped),
    busiestDay,
    busiestMonth,
    longestStreak: longest,
    months,
  };
}

/* ---- One member over the last twelve months ---- */

/**
 * Voice time of one member on each of the last 53 weeks, ending with the current week. `totals` has one
 * value per day from `startKey` (the first day of a week), always a whole number of weeks; the days after today (the end of the current
 * week) are the ones from index `elapsedDays` on, and hold nothing yet.
 */
export interface MemberYear {
  startKey: string;
  totals: number[];
  elapsedDays: number;
}

/** A set of sessions (a member's, or the whole group's) as a year of days, for a contribution-style grid. */
export function buildMemberYear(ownSessions: readonly Session[], nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): MemberYear {
  const today = dayNumber(timelineDayKey(nowMs, timeZone));
  const rawStart = today - 52 * 7 - weekdayIndex(today, weekStart); // the first day of the week 52 weeks before this one
  const dayCount = 53 * 7;
  const startKey = dayKeyOf(rawStart);
  const firstWindow = timelineDayWindow(startKey, timeZone);
  const lastWindow = timelineDayWindow(dayKeyOf(rawStart + dayCount - 1), timeZone);
  const clipped = clipSessions(ownSessions, firstWindow.startMs, Math.min(lastWindow.endMs, nowMs), nowMs);
  return { startKey, totals: totalsPerDay(clipped, rawStart, dayCount, timeZone), elapsedDays: today - rawStart + 1 };
}
