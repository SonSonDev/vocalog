import { buildDayTimeline, dayKeyOf, dayNumber, timelineDayKey } from '@vocalog/shared';
import type { DayView, GuildInfo } from '@vocalog/shared';
import { createNamer } from './names.ts';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

/** One day in detail, or null when it is after today (nothing can have happened yet). */
export function buildDayView(db: Db, guild: GuildInfo, dayKey: string, nowMs: number, timeZone: string): DayView | null {
  const today = timelineDayKey(nowMs, timeZone);
  if (dayNumber(dayKey) > dayNumber(today)) return null;

  const day = buildDayTimeline(loadGuildSessions(db, guild.id), dayKey, nowMs, timeZone);
  const { user, channel } = createNamer(db, guild.id);
  const first = firstEventMs(db, guild.id);
  const firstDay = first === null ? today : timelineDayKey(first, timeZone);

  return {
    guild,
    dayKey,
    startMs: day.startMs,
    endMs: day.endMs,
    timeZone,
    generatedAtMs: nowMs,
    prevDayKey: dayNumber(dayKey) > dayNumber(firstDay) ? dayKeyOf(dayNumber(dayKey) - 1) : null,
    nextDayKey: dayNumber(dayKey) < dayNumber(today) ? dayKeyOf(dayNumber(dayKey) + 1) : null,
    totalMs: day.totalMs,
    peak: day.peak,
    bins: day.bins,
    members: day.members.map((member) => ({
      user: user(member.userId),
      totalMs: member.totalMs,
      spans: member.spans.map((span) => ({ channel: channel(span.channelId), startMs: span.startMs, endMs: span.endMs })),
    })),
  };
}
