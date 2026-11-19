import { buildYearCalendar, timelineDayKey, yearOf } from '@vocalog/shared';
import type { GuildInfo, WeekStart, YearView } from '@vocalog/shared';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

/** One year as twelve small calendars, or null when it starts after today. (`YYYY` keys sort like the years they name.) */
export function buildYearView(db: Db, guild: GuildInfo, yearKey: string, nowMs: number, timeZone: string, weekStart: WeekStart = 'monday'): YearView | null {
  const thisYear = yearOf(timelineDayKey(nowMs, timeZone));
  if (yearKey > thisYear) return null;

  const calendar = buildYearCalendar(loadGuildSessions(db, guild.id), yearKey, nowMs, timeZone, weekStart);
  const first = firstEventMs(db, guild.id);
  const firstYear = first === null ? thisYear : yearOf(timelineDayKey(first, timeZone));

  return {
    ...calendar,
    guild,
    timeZone,
    generatedAtMs: nowMs,
    prevYearKey: yearKey > firstYear ? String(Number(yearKey) - 1) : null,
    nextYearKey: yearKey < thisYear ? String(Number(yearKey) + 1) : null,
  };
}
