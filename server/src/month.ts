import { addMonths, buildMonthCalendar, monthOf, timelineDayKey } from '@vocalog/shared';
import type { GuildInfo, MonthView, WeekStart } from '@vocalog/shared';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

/** One month as a calendar, or null when it starts after today. (`YYYY-MM` keys sort like the months they name.) */
export function buildMonthView(db: Db, guild: GuildInfo, monthKey: string, nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): MonthView | null {
  const thisMonth = monthOf(timelineDayKey(nowMs, timeZone));
  if (monthKey > thisMonth) return null;

  const calendar = buildMonthCalendar(loadGuildSessions(db, guild.id), monthKey, nowMs, timeZone, weekStart);
  const first = firstEventMs(db, guild.id);
  const firstMonth = first === null ? thisMonth : monthOf(timelineDayKey(first, timeZone));

  return {
    ...calendar,
    guild,
    timeZone,
    generatedAtMs: nowMs,
    prevMonthKey: monthKey > firstMonth ? addMonths(monthKey, -1) : null,
    nextMonthKey: monthKey < thisMonth ? addMonths(monthKey, 1) : null,
  };
}
