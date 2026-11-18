import { aggregate } from '@vocalog/shared';
import type { GuildInfo, NamedRef, Period, Summary } from '@vocalog/shared';
import { periodWindow } from './period.ts';
import { channelNames, firstEventMs, loadGuildSessions, userHandles, userNames } from './queries.ts';
import type { Db } from './queries.ts';

export function buildSummary(db: Db, guild: GuildInfo, period: Period, nowMs: number, timeZone: string): Summary {
  const { fromMs, toMs } = periodWindow(period, nowMs, firstEventMs(db, guild.id));
  const result = aggregate(loadGuildSessions(db, guild.id), { fromMs, toMs, nowMs, timeZone });

  const users = userNames(db, guild.id);
  const handles = userHandles(db);
  const channels = channelNames(db, guild.id);
  const user = (id: string): NamedRef => ({ id, name: users.get(id) ?? `Membre ${id.slice(-4)}`, handle: handles.get(id) });
  const channel = (id: string): NamedRef => ({ id, name: channels.get(id) ?? `Salon ${id.slice(-4)}` });

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
  };
}
