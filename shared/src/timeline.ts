import { clipSessions, dayKeyOf, dayNumber, localParts, peakOf, weekdayOf } from './aggregate.ts';
import type { Session } from './types.ts';

/** A "day" of the timelines runs from 06:00 to 06:00, so an evening that goes past midnight stays in one piece. */
export const TIMELINE_DAY_START_HOUR = 6;
const STRIP_BIN_MS = 30 * 60_000;
const DAY_BIN_MS = 15 * 60_000;

/** Offset of a time zone from UTC at an instant, in ms (positive east of Greenwich). */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = localParts(ms, timeZone);
  const [year, month, day] = parts.dayKey.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!, parts.hour, parts.minute, parts.second) - Math.floor(ms / 1000) * 1000;
}

/** The UTC instant of a local wall-clock time (`dayKey` is `YYYY-MM-DD` in `timeZone`). Handles daylight saving shifts. */
export function zonedTime(dayKey: string, hour: number, minute: number, timeZone: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  const wanted = Date.UTC(year!, month! - 1, day!, hour, minute);
  // Two passes settle on the right offset around a daylight saving change.
  const first = wanted - zoneOffsetMs(wanted, timeZone);
  return wanted - zoneOffsetMs(first, timeZone);
}

/** The timeline day (`YYYY-MM-DD` of its 06:00 start) that contains this instant. */
export function timelineDayKey(ms: number, timeZone: string): string {
  const parts = localParts(ms, timeZone);
  return parts.hour < TIMELINE_DAY_START_HOUR ? dayKeyOf(dayNumber(parts.dayKey) - 1) : parts.dayKey;
}

export function timelineDayWindow(dayKey: string, timeZone: string): { startMs: number; endMs: number } {
  return {
    startMs: zonedTime(dayKey, TIMELINE_DAY_START_HOUR, 0, timeZone),
    endMs: zonedTime(dayKeyOf(dayNumber(dayKey) + 1), TIMELINE_DAY_START_HOUR, 0, timeZone),
  };
}

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKeyOf(dayNumber(value)) === value;
}

/** Average number of people present in each bin of the window (0 when nobody). Sessions must already be clipped to the window. */
export function presenceBins(clipped: readonly Session[], startMs: number, endMs: number, binMs: number): number[] {
  const count = Math.max(0, Math.ceil((endMs - startMs) / binMs));
  const bins = new Array<number>(count).fill(0);
  for (const session of clipped) {
    const to = session.endMs!;
    for (let index = Math.max(0, Math.floor((session.startMs - startMs) / binMs)); index < count; index++) {
      const binStart = startMs + index * binMs;
      if (binStart >= to) break;
      const overlap = Math.min(to, binStart + binMs) - Math.max(session.startMs, binStart);
      if (overlap > 0) bins[index]! += overlap / binMs;
    }
  }
  return bins.map((value) => Math.round(value * 100) / 100);
}

export interface DayStrip {
  dayKey: string;
  /** 0 = Monday. */
  weekday: number;
  startMs: number;
  endMs: number;
  /** Voice time of everybody that day. */
  totalMs: number;
  /** Different people who were in voice. */
  people: number;
  /** Most people at once. */
  peak: number;
  /** Average number of people in each half hour from the start of the day. */
  bins: number[];
}

export interface DayTimelineInput {
  fromMs: number;
  /** End of the window; never later than `nowMs`. */
  limitMs: number;
  nowMs: number;
  timeZone: string;
  /** At most this many days, newest first. */
  maxDays: number;
}

/** One strip per timeline day of the window, newest first. */
export function dayStrips(sessions: readonly Session[], input: DayTimelineInput): DayStrip[] {
  const { fromMs, limitMs, nowMs, timeZone, maxDays } = input;
  if (limitMs <= fromMs) return [];
  const firstDay = dayNumber(timelineDayKey(fromMs, timeZone));
  const lastDay = dayNumber(timelineDayKey(limitMs - 1, timeZone));
  const strips: DayStrip[] = [];
  for (let day = lastDay; day >= firstDay && strips.length < maxDays; day--) {
    const dayKey = dayKeyOf(day);
    const { startMs, endMs } = timelineDayWindow(dayKey, timeZone);
    const clipped = clipSessions(sessions, startMs, Math.min(endMs, limitMs), nowMs);
    strips.push({
      dayKey,
      weekday: weekdayOf(day),
      startMs,
      endMs,
      totalMs: clipped.reduce((sum, session) => sum + (session.endMs! - session.startMs), 0),
      people: new Set(clipped.map((session) => session.userId)).size,
      peak: peakOf(clipped)?.count ?? 0,
      bins: presenceBins(clipped, startMs, endMs, STRIP_BIN_MS),
    });
  }
  return strips;
}

export interface DayTimeline {
  dayKey: string;
  startMs: number;
  endMs: number;
  totalMs: number;
  peak: { count: number; atMs: number } | null;
  /** Average number of people in each quarter hour from the start of the day. */
  bins: number[];
  /** Who was in voice that day, first arrival first. */
  members: { userId: string; totalMs: number; spans: { channelId: string; startMs: number; endMs: number }[] }[];
}

/** Everything that happened in one timeline day, sessions clipped to it (an open session ends at `nowMs`). */
export function buildDayTimeline(sessions: readonly Session[], dayKey: string, nowMs: number, timeZone: string): DayTimeline {
  const { startMs, endMs } = timelineDayWindow(dayKey, timeZone);
  const clipped = clipSessions(sessions, startMs, Math.min(endMs, nowMs), nowMs);
  const byUser = new Map<string, DayTimeline['members'][number]>();
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
  members.sort((a, b) => a.spans[0]!.startMs - b.spans[0]!.startMs || a.userId.localeCompare(b.userId));
  return {
    dayKey,
    startMs,
    endMs,
    totalMs: members.reduce((sum, member) => sum + member.totalMs, 0),
    peak: peakOf(clipped),
    bins: presenceBins(clipped, startMs, endMs, DAY_BIN_MS),
    members,
  };
}
