import { buildWeekTimeline, dayKeyOf, dayNumber, mondayOf, timelineDayKey } from '@vocalog/shared';
import type { GuildInfo, WeekView } from '@vocalog/shared';
import { createNamer } from './names.ts';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

/** One week in detail, or null when it starts after today (nothing can have happened yet). */
export function buildWeekView(db: Db, guild: GuildInfo, mondayKey: string, nowMs: number, timeZone: string): WeekView | null {
  const today = mondayOf(timelineDayKey(nowMs, timeZone));
  if (dayNumber(mondayKey) > dayNumber(today)) return null;

  const week = buildWeekTimeline(loadGuildSessions(db, guild.id), mondayKey, nowMs, timeZone);
  const { user, channel } = createNamer(db, guild.id);
  const first = firstEventMs(db, guild.id);
  const firstMonday = first === null ? today : mondayOf(timelineDayKey(first, timeZone));

  return {
    guild,
    mondayKey,
    startMs: week.startMs,
    endMs: week.endMs,
    timeZone,
    generatedAtMs: nowMs,
    prevMondayKey: dayNumber(mondayKey) > dayNumber(firstMonday) ? dayKeyOf(dayNumber(mondayKey) - 7) : null,
    nextMondayKey: dayNumber(mondayKey) < dayNumber(today) ? dayKeyOf(dayNumber(mondayKey) + 7) : null,
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
