import { durationMs } from './sessions.ts';
import type { Session } from './types.ts';

export interface AggregateOptions {
  /** Start of the window (UTC ms, inclusive). */
  fromMs: number;
  /** End of the window (UTC ms, exclusive). */
  toMs: number;
  /** Current time; open sessions are measured up to it. */
  nowMs: number;
  /** IANA time zone used for hours, weekdays and days, for example `Europe/Paris`. */
  timeZone: string;
}

export interface MemberStat {
  userId: string;
  totalMs: number;
  sessions: number;
  /** Voice time per local hour of day (24 values). */
  hourMs: number[];
}

export interface ChannelStat {
  channelId: string;
  totalMs: number;
}

export interface Aggregate {
  totalMs: number;
  sessionCount: number;
  activeMembers: number;
  /** Number of days in the window, at least 1. */
  days: number;
  avgPerDayMs: number;
  members: MemberStat[];
  channels: ChannelStat[];
  /** Voice time in ms, indexed [weekday 0=Monday..6=Sunday][local hour 0..23]. */
  heat: number[][];
  longestSession: { userId: string; channelId: string; startMs: number; durationMs: number } | null;
  /** Most people in voice at the same time in the window. */
  peak: { count: number; atMs: number } | null;
  /** Consecutive local days, ending today or yesterday, with at least one person in voice (ignores the window). */
  streakDays: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface LocalParts {
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  dayKey: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function localParts(ms: number, timeZone: string): LocalParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(ms)) values[part.type] = part.value;
  return {
    weekday: WEEKDAYS.indexOf(values.weekday ?? ''),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    dayKey: `${values.year}-${values.month}-${values.day}`,
  };
}

/** Splits [startMs, endMs) at local hour boundaries. */
export function* hourSlices(startMs: number, endMs: number, timeZone: string) {
  let cursor = startMs;
  while (cursor < endMs) {
    const parts = localParts(cursor, timeZone);
    const millis = ((cursor % 1000) + 1000) % 1000;
    const intoHour = parts.minute * 60_000 + parts.second * 1000 + millis;
    const next = Math.min(endMs, cursor + (HOUR_MS - intoHour));
    yield { startMs: cursor, endMs: next, weekday: parts.weekday, hour: parts.hour, dayKey: parts.dayKey };
    cursor = next;
  }
}

/** Days since 1970-01-01 of a local `YYYY-MM-DD` key. */
export function dayNumber(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  return Math.round(Date.UTC(year!, month! - 1, day!) / DAY_MS);
}

/** The local `YYYY-MM-DD` key of a day number. */
export function dayKeyOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Weekday of a day number, 0 = Monday (1970-01-01 was a Thursday). */
export function weekdayOf(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/**
 * Consecutive local days with at least one session. `current` ends today or yesterday
 * (0 when neither has any); `best` is the longest run ever. Ignores any window.
 */
export function streaks(sessions: readonly Session[], nowMs: number, timeZone: string): { current: number; best: number } {
  const days = new Set<number>();
  for (const session of sessions) {
    const end = session.endMs ?? nowMs;
    if (end <= session.startMs) continue;
    // Every local day between the first and the last instant of the session: no need to cut it by hour.
    const last = dayNumber(localParts(end - 1, timeZone).dayKey);
    for (let day = dayNumber(localParts(session.startMs, timeZone).dayKey); day <= last; day++) days.add(day);
  }

  let best = 0;
  for (const day of days) {
    if (days.has(day - 1)) continue; // not the start of a run
    let length = 0;
    while (days.has(day + length)) length++;
    if (length > best) best = length;
  }

  const today = dayNumber(localParts(nowMs, timeZone).dayKey);
  let day = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  let current = 0;
  while (day !== null && days.has(day)) {
    current++;
    day--;
  }
  return { current, best };
}

/** Sessions clipped to [fromMs, limitMs); open sessions end at `nowMs`. Empty results are dropped. */
export function clipSessions(sessions: readonly Session[], fromMs: number, limitMs: number, nowMs: number): Session[] {
  const clipped: Session[] = [];
  for (const session of sessions) {
    const startMs = Math.max(session.startMs, fromMs);
    const endMs = Math.min(session.endMs ?? nowMs, limitMs);
    if (endMs > startMs) clipped.push({ ...session, startMs, endMs });
  }
  return clipped;
}

function peakOf(sessions: readonly Session[]): { count: number; atMs: number } | null {
  const points: { atMs: number; delta: number }[] = [];
  for (const session of sessions) {
    points.push({ atMs: session.startMs, delta: 1 }, { atMs: session.endMs!, delta: -1 });
  }
  // At equal times, leaves come before joins so a hand-over is not counted as overlap.
  points.sort((a, b) => a.atMs - b.atMs || a.delta - b.delta);
  let current = 0;
  let best: { count: number; atMs: number } | null = null;
  for (const point of points) {
    current += point.delta;
    if (point.delta === 1 && (best === null || current > best.count)) best = { count: current, atMs: point.atMs };
  }
  return best;
}

/** Statistics for one server: pass only the sessions of that server. */
export function aggregate(sessions: readonly Session[], options: AggregateOptions): Aggregate {
  const { fromMs, toMs, nowMs, timeZone } = options;
  const limit = Math.min(toMs, nowMs);

  const clipped = clipSessions(sessions, fromMs, limit, nowMs);

  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const members = new Map<string, MemberStat>();
  const channels = new Map<string, number>();
  let totalMs = 0;
  let longest: Aggregate['longestSession'] = null;

  for (const session of clipped) {
    const length = durationMs(session, nowMs);
    totalMs += length;
    channels.set(session.channelId, (channels.get(session.channelId) ?? 0) + length);

    let member = members.get(session.userId);
    if (!member) {
      member = { userId: session.userId, totalMs: 0, sessions: 0, hourMs: new Array<number>(24).fill(0) };
      members.set(session.userId, member);
    }
    member.totalMs += length;
    member.sessions += 1;

    for (const slice of hourSlices(session.startMs, session.endMs!, timeZone)) {
      const part = slice.endMs - slice.startMs;
      member.hourMs[slice.hour]! += part;
      heat[slice.weekday]![slice.hour]! += part;
    }

    if (longest === null || length > longest.durationMs) {
      longest = { userId: session.userId, channelId: session.channelId, startMs: session.startMs, durationMs: length };
    }
  }

  const days = Math.max(1, Math.ceil((limit - fromMs) / DAY_MS));

  return {
    totalMs,
    sessionCount: clipped.length,
    activeMembers: members.size,
    days,
    avgPerDayMs: totalMs / days,
    members: [...members.values()].sort((a, b) => b.totalMs - a.totalMs),
    channels: [...channels.entries()].map(([channelId, ms]) => ({ channelId, totalMs: ms })).sort((a, b) => b.totalMs - a.totalMs),
    heat,
    longestSession: longest,
    peak: peakOf(clipped),
    streakDays: streaks(sessions, nowMs, timeZone).current,
  };
}
