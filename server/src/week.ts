import { buildWeekTimeline, dayKeyOf, dayNumber, weekStartOf, timelineDayKey } from '@vocalog/shared';
import type { GuildInfo, WeekStart, WeekView } from '@vocalog/shared';
import { createNamer } from './names.ts';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

/** One week in detail, or null when it starts after today (nothing can have happened yet). */
export function buildWeekView(db: Db, guild: GuildInfo, startKey: string, nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): WeekView | null {
  const today = weekStartOf(timelineDayKey(nowMs, timeZone), weekStart);
  if (dayNumber(startKey) > dayNumber(today)) return null;

  const week = buildWeekTimeline(loadGuildSessions(db, guild.id), startKey, nowMs, timeZone);
  const { user, channel } = createNamer(db, guild.id);
  const first = firstEventMs(db, guild.id);
  const firstWeek = first === null ? today : weekStartOf(timelineDayKey(first, timeZone), weekStart);

  return {
    guild,
    startKey,
    startMs: week.startMs,
    endMs: week.endMs,
    timeZone,
    generatedAtMs: nowMs,
    prevStartKey: dayNumber(startKey) > dayNumber(firstWeek) ? dayKeyOf(dayNumber(startKey) - 7) : null,
    nextStartKey: dayNumber(startKey) < dayNumber(today) ? dayKeyOf(dayNumber(startKey) + 7) : null,
    days: week.days,
    totalMs: week.totalMs,
    peak: week.peak,
    bins: week.bins,
    members: week.members.map((member) => ({
      user: user(member.userId),
      totalMs: member.totalMs,
      spans: member.spans.map((span) => ({ channel: channel(span.channelId), startMs: span.startMs, endMs: span.endMs })),
    })),
  };
}
