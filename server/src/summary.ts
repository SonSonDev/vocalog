import { aggregate, dayStrips } from '@vocalog/shared';
import type { GuildInfo, Period, Summary } from '@vocalog/shared';
import { periodWindow } from './period.ts';
import { createNamer } from './names.ts';
import { firstEventMs, loadGuildSessions } from './queries.ts';
import type { Db } from './queries.ts';

const MAX_STRIP_DAYS = 31;

export function buildSummary(db: Db, guild: GuildInfo, period: Period, nowMs: number, timeZone: string): Summary {
  const { fromMs, toMs } = periodWindow(period, nowMs, firstEventMs(db, guild.id));
  const sessions = loadGuildSessions(db, guild.id);
  const result = aggregate(sessions, { fromMs, toMs, nowMs, timeZone });
  const { user, channel } = createNamer(db, guild.id);

  return {
    guild,
    period,
    fromMs,
    toMs,
    timeZone,
    generatedAtMs: nowMs,
    totals: {
      totalMs: result.totalMs,
      avgPerDayMs: result.avgPerDayMs,
      sessionCount: result.sessionCount,
      activeMembers: result.activeMembers,
      days: result.days,
      streakDays: result.streakDays,
    },
    longestSession: result.longestSession
      ? {
          user: user(result.longestSession.userId),
          channel: channel(result.longestSession.channelId),
          startMs: result.longestSession.startMs,
          durationMs: result.longestSession.durationMs,
        }
      : null,
    peak: result.peak,
    members: result.members.map((member) => ({ user: user(member.userId), totalMs: member.totalMs, sessions: member.sessions, hourMs: member.hourMs })),
    channels: result.channels.map((entry) => ({ channel: channel(entry.channelId), totalMs: entry.totalMs })),
    heat: result.heat,
    days: dayStrips(sessions, { fromMs, limitMs: Math.min(toMs, nowMs), nowMs, timeZone, maxDays: MAX_STRIP_DAYS }),
  };
}
