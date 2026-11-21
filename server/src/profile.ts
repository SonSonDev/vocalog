import { buildMemberStats, buildMemberYear, deriveSessions } from '@vocalog/shared';
import type { GuildInfo, MemberProfile, Period, WeekStart } from '@vocalog/shared';
import { periodWindow } from './period.ts';
import { createNamer } from './names.ts';
import { afkChannelId, firstEventMs, loadGuildEvents } from './queries.ts';
import type { Db } from './queries.ts';

export function buildMemberProfile(
  db: Db,
  guild: GuildInfo,
  userId: string,
  period: Period,
  nowMs: number,
  timeZone: string,
  weekStart: WeekStart = 'monday',
): MemberProfile {
  const { fromMs, toMs } = periodWindow(period, nowMs, firstEventMs(db, guild.id));
  const events = loadGuildEvents(db, guild.id);
  const sessions = deriveSessions(events);
  const stats = buildMemberStats({ sessions, events, userId, options: { fromMs, toMs, nowMs, timeZone, weekStart } });

  const { user, channel } = createNamer(db, guild.id);
  const afkId = afkChannelId(db, guild.id);

  const { userId: _userId, channels: statChannels, together, longestSession, ...rest } = stats;
  return {
    ...rest,
    yearGrid: buildMemberYear(
      sessions.filter((session) => session.userId === userId),
      nowMs,
      timeZone,
      weekStart,
    ),
    guild,
    user: user(userId),
    period,
    fromMs,
    toMs,
    timeZone,
    generatedAtMs: nowMs,
    longestSession: longestSession ? { channel: channel(longestSession.channelId), startMs: longestSession.startMs, durationMs: longestSession.durationMs } : null,
    channels: statChannels.map((entry) => ({ channel: channel(entry.channelId), totalMs: entry.totalMs, afk: entry.channelId === afkId })),
    together: {
      withOthersMs: together.withOthersMs,
      aloneMs: together.aloneMs,
      top: together.top.map((entry) => ({ user: user(entry.userId), ms: entry.ms })),
    },
  };
}
