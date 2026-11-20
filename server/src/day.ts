import { buildDayTimeline, dayKeyOf, dayNumber, flagIntervalsByUser, timelineDayKey } from '@vocalog/shared';
import type { DayView, GuildInfo } from '@vocalog/shared';
import { createNamer } from './names.ts';
import { deriveSessions } from '@vocalog/shared';
import { afkChannelId, firstEventMs, loadGuildEvents } from './queries.ts';
import type { Db } from './queries.ts';

/** One day in detail, or null when it is after today (nothing can have happened yet). */
export function buildDayView(db: Db, guild: GuildInfo, dayKey: string, nowMs: number, timeZone: string): DayView | null {
  const today = timelineDayKey(nowMs, timeZone);
  if (dayNumber(dayKey) > dayNumber(today)) return null;

  const events = loadGuildEvents(db, guild.id);
  const day = buildDayTimeline(deriveSessions(events), dayKey, nowMs, timeZone);
  const states = flagIntervalsByUser(events, { fromMs: day.startMs, toMs: day.endMs }, nowMs);
  const { user, channel } = createNamer(db, guild.id);
  const afkId = afkChannelId(db, guild.id);
  const members = day.members.map((member) => {
    const spans = member.spans.map((span) => ({ channel: channel(span.channelId), startMs: span.startMs, endMs: span.endMs, afk: afkId !== null && span.channelId === afkId }));
    return {
      user: user(member.userId),
      totalMs: member.totalMs,
      afkMs: spans.reduce((sum, span) => sum + (span.afk ? span.endMs - span.startMs : 0), 0),
      spans,
      states: states.get(member.userId) ?? { share: [], mute: [], deaf: [] },
    };
  });
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
    afkMs: members.reduce((sum, member) => sum + member.afkMs, 0),
    members,
  };
}
