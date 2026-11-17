import { aggregate, clipSessions, dayKeyOf, dayNumber, hourSlices, localParts, streaks, weekdayOf } from './aggregate.ts';
import type { AggregateOptions, ChannelStat } from './aggregate.ts';
import { emptyFlagTimes, flagTimesByUser } from './flags.ts';
import type { FlagTimes } from './flags.ts';
import { togetherWithUser } from './together.ts';
import type { Session, VoiceEvent } from './types.ts';

const MINUTES_PER_DAY = 1440;
/** The "day" of a night owl starts at 06:00, so 23:00 and 01:00 average out to midnight rather than noon. */
const DAY_START_MINUTE = 360;
const DAILY_BUCKETS_UP_TO_DAYS = 92;
const TOP_FRIENDS = 8;

export interface PartsOfDay {
  /** 06:00 to 11:59 local time. */
  morningMs: number;
  /** 12:00 to 17:59. */
  afternoonMs: number;
  /** 18:00 to 23:59. */
  eveningMs: number;
  /** 00:00 to 05:59. */
  nightMs: number;
}

export interface ActivityBucket {
  /** Local date `YYYY-MM-DD` of the day, or of the Monday of the week. */
  startKey: string;
  ms: number;
}

/** Personal statistics of one member of one server, with ids (names are added by the server). */
export interface MemberStats {
  userId: string;
  days: number;
  totalMs: number;
  sessions: number;
  avgPerDayMs: number;
  avgSessionMs: number;
  longestSession: { channelId: string; startMs: number; durationMs: number } | null;
  /** Voice time per local hour of day (24 values). */
  hourMs: number[];
  /** [weekday 0=Monday..6=Sunday][local hour]. */
  heat: number[][];
  channels: ChannelStat[];
  /** One bucket per day (window up to 92 days) or per week (longer windows). */
  activity: { granularity: 'day' | 'week'; buckets: ActivityBucket[] };
  together: {
    /** Time in a channel with at least one other person. */
    withOthersMs: number;
    /** Time in a channel with nobody else. */
    aloneMs: number;
    top: { userId: string; ms: number }[];
  };
  voiceStates: FlagTimes;
  habits: {
    /** Average local start time of a session, minute of the day (0 to 1439), or null without sessions. */
    avgArrivalMinute: number | null;
    avgDepartureMinute: number | null;
    partsOfDay: PartsOfDay;
    previousTotalMs: number;
    /** Change versus the previous window of the same length, in percent; null when there is nothing to compare. */
    changePercent: number | null;
  };
  roomRoles: {
    /** Times the member joined a channel nobody else was in. */
    opened: number;
    /** Times the member left a channel and nobody else stayed. */
    closed: number;
  };
  /** Consecutive days with the member in voice. Ignores the window. */
  streak: { current: number; best: number };
  /** Sessions that include the 03:00 to 03:59 local hour. */
  lateSessions: number;
  group: {
    rank: number | null;
    of: number;
    avgMemberTotalMs: number;
    avgSessionMs: number;
    avgArrivalMinute: number | null;
    /** Share of voice time spent muted by the whole group, 0 to 1, or null without data. */
    mutedShare: number | null;
    partsOfDay: PartsOfDay;
  };
}

export function partsOfDay(hourMs: readonly number[]): PartsOfDay {
  const sum = (from: number, to: number): number => {
    let total = 0;
    for (let hour = from; hour <= to; hour++) total += hourMs[hour] ?? 0;
    return total;
  };
  return { morningMs: sum(6, 11), afternoonMs: sum(12, 17), eveningMs: sum(18, 23), nightMs: sum(0, 5) };
}

/** Average of times of day (minutes 0 to 1439), computed on a day that starts at 06:00. Null when empty. */
export function averageMinute(minutes: readonly number[]): number | null {
  if (minutes.length === 0) return null;
  const shifted = minutes.map((minute) => (minute - DAY_START_MINUTE + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  const mean = shifted.reduce((sum, value) => sum + value, 0) / shifted.length;
  return (Math.round(mean) + DAY_START_MINUTE) % MINUTES_PER_DAY;
}

function minuteOfDay(ms: number, timeZone: string): number {
  const parts = localParts(ms, timeZone);
  return parts.hour * 60 + parts.minute;
}

/** Voice time per local day, or per week (Monday start) when the window is long. Zero-filled over the whole window. */
export function activityBuckets(
  clipped: readonly Session[],
  timeZone: string,
  fromMs: number,
  limitMs: number,
): { granularity: 'day' | 'week'; buckets: ActivityBucket[] } {
  const perDay = new Map<number, number>();
  for (const session of clipped) {
    for (const slice of hourSlices(session.startMs, session.endMs!, timeZone)) {
      const day = dayNumber(slice.dayKey);
      perDay.set(day, (perDay.get(day) ?? 0) + (slice.endMs - slice.startMs));
    }
  }

  const firstDay = dayNumber(localParts(fromMs, timeZone).dayKey);
  const lastDay = Math.max(firstDay, dayNumber(localParts(Math.max(fromMs, limitMs - 1), timeZone).dayKey));
  const dayCount = lastDay - firstDay + 1;

  if (dayCount <= DAILY_BUCKETS_UP_TO_DAYS) {
    const buckets: ActivityBucket[] = [];
    for (let day = firstDay; day <= lastDay; day++) buckets.push({ startKey: dayKeyOf(day), ms: perDay.get(day) ?? 0 });
    return { granularity: 'day', buckets };
  }

  const buckets: ActivityBucket[] = [];
  for (let weekStart = firstDay - weekdayOf(firstDay); weekStart <= lastDay; weekStart += 7) {
    let ms = 0;
    for (let day = weekStart; day < weekStart + 7; day++) ms += perDay.get(day) ?? 0;
    buckets.push({ startKey: dayKeyOf(weekStart), ms });
  }
  return { granularity: 'week', buckets };
}

/** How many times the member opened (joined an empty channel) and closed (left leaving it empty) a channel. */
export function roomRoles(
  sessions: readonly Session[],
  userId: string,
  fromMs: number,
  limitMs: number,
  nowMs: number,
): { opened: number; closed: number } {
  const byChannel = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = `${session.guildId}:${session.channelId}`;
    const list = byChannel.get(key);
    if (list) list.push(session);
    else byChannel.set(key, [session]);
  }

  let opened = 0;
  let closed = 0;
  for (const own of sessions) {
    if (own.userId !== userId) continue;
    const others = (byChannel.get(`${own.guildId}:${own.channelId}`) ?? []).filter((other) => other.userId !== userId);
    const someoneAt = (atMs: number): boolean => others.some((other) => other.startMs <= atMs && (other.endMs ?? nowMs) > atMs);

    if (own.startMs >= fromMs && own.startMs < limitMs && !someoneAt(own.startMs)) opened++;
    if (own.endMs !== null && own.endMs > fromMs && own.endMs <= limitMs && !someoneAt(own.endMs)) closed++;
  }
  return { opened, closed };
}

function sumFlags(all: Iterable<FlagTimes>): FlagTimes {
  const total = emptyFlagTimes();
  for (const times of all) {
    total.voiceMs += times.voiceMs;
    total.mutedMs += times.mutedMs;
    total.deafMs += times.deafMs;
    total.streamingMs += times.streamingMs;
    total.videoMs += times.videoMs;
  }
  return total;
}

export interface MemberStatsInput {
  /** Sessions of the whole server (not only the member). */
  sessions: readonly Session[];
  /** Events of the whole server. */
  events: readonly VoiceEvent[];
  userId: string;
  options: AggregateOptions;
}

export function buildMemberStats({ sessions, events, userId, options }: MemberStatsInput): MemberStats {
  const { fromMs, toMs, nowMs, timeZone } = options;
  const limitMs = Math.min(toMs, nowMs);

  const own = sessions.filter((session) => session.userId === userId);
  const ownAgg = aggregate(own, options);
  const groupAgg = aggregate(sessions, options);
  const clippedAll = clipSessions(sessions, fromMs, limitMs, nowMs);
  const clippedOwn = clipSessions(own, fromMs, limitMs, nowMs);

  const row = ownAgg.members[0];
  const hourMs = row?.hourMs ?? new Array<number>(24).fill(0);
  const totalMs = ownAgg.totalMs;

  const length = Math.max(0, limitMs - fromMs);
  const previousTotalMs = aggregate(own, { ...options, fromMs: fromMs - length, toMs: fromMs }).totalMs;
  const changePercent = previousTotalMs > 0 ? Math.round(((totalMs - previousTotalMs) / previousTotalMs) * 100) : null;

  const together = togetherWithUser(clippedAll, userId, nowMs);
  const top = [...together.byUser.entries()]
    .map(([otherId, ms]) => ({ userId: otherId, ms }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, TOP_FRIENDS);

  const flagTimes = flagTimesByUser(events, { fromMs, toMs }, nowMs);
  const groupFlags = sumFlags(flagTimes.values());

  const arrivals = (list: readonly Session[]): number[] =>
    list.filter((s) => s.startMs >= fromMs && s.startMs < limitMs).map((s) => minuteOfDay(s.startMs, timeZone));
  const departures = (list: readonly Session[]): number[] =>
    list.filter((s) => s.endMs !== null && s.endMs > fromMs && s.endMs <= limitMs).map((s) => minuteOfDay(s.endMs!, timeZone));

  const groupHours = new Array<number>(24).fill(0);
  for (const member of groupAgg.members) member.hourMs.forEach((value, hour) => (groupHours[hour]! += value));

  let lateSessions = 0;
  for (const session of clippedOwn) {
    for (const slice of hourSlices(session.startMs, session.endMs!, timeZone)) {
      if (slice.hour === 3) {
        lateSessions++;
        break;
      }
    }
  }

  const rankIndex = groupAgg.members.findIndex((member) => member.userId === userId);

  return {
    userId,
    days: ownAgg.days,
    totalMs,
    sessions: ownAgg.sessionCount,
    avgPerDayMs: ownAgg.avgPerDayMs,
    avgSessionMs: ownAgg.sessionCount > 0 ? totalMs / ownAgg.sessionCount : 0,
    longestSession: ownAgg.longestSession
      ? {
          channelId: ownAgg.longestSession.channelId,
          startMs: ownAgg.longestSession.startMs,
          durationMs: ownAgg.longestSession.durationMs,
        }
      : null,
    hourMs,
    heat: ownAgg.heat,
    channels: ownAgg.channels,
    activity: activityBuckets(clippedOwn, timeZone, fromMs, limitMs),
    together: { withOthersMs: together.withOthersMs, aloneMs: Math.max(0, totalMs - together.withOthersMs), top },
    voiceStates: flagTimes.get(userId) ?? emptyFlagTimes(),
    habits: {
      avgArrivalMinute: averageMinute(arrivals(own)),
      avgDepartureMinute: averageMinute(departures(own)),
      partsOfDay: partsOfDay(hourMs),
      previousTotalMs,
      changePercent,
    },
    roomRoles: roomRoles(sessions, userId, fromMs, limitMs, nowMs),
    streak: streaks(own, nowMs, timeZone),
    lateSessions,
    group: {
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      of: groupAgg.activeMembers,
      avgMemberTotalMs: groupAgg.activeMembers > 0 ? groupAgg.totalMs / groupAgg.activeMembers : 0,
      avgSessionMs: groupAgg.sessionCount > 0 ? groupAgg.totalMs / groupAgg.sessionCount : 0,
      avgArrivalMinute: averageMinute(arrivals(sessions)),
      mutedShare: groupFlags.voiceMs > 0 ? groupFlags.mutedMs / groupFlags.voiceMs : null,
      partsOfDay: partsOfDay(groupHours),
    },
  };
}
