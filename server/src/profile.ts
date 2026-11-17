import { buildMemberStats, deriveSessions } from '@vocalog/shared';
import type { GuildInfo, MemberProfile, NamedRef, Period } from '@vocalog/shared';
import { periodWindow } from './period.ts';
import { channelNames, firstEventMs, loadGuildEvents, userNames } from './queries.ts';
import type { Db } from './queries.ts';

/**
 * `restricted` removes what only the person concerned may see (microphone, headphones, screen sharing and camera
 * time, and the group's muted share that would reveal it). It is removed here, not hidden by the web app.
 */
export function buildMemberProfile(
  db: Db,
  guild: GuildInfo,
  userId: string,
  period: Period,
  nowMs: number,
  timeZone: string,
  restricted: boolean,
): MemberProfile {
  const { fromMs, toMs } = periodWindow(period, nowMs, firstEventMs(db, guild.id));
  const events = loadGuildEvents(db, guild.id);
  const sessions = deriveSessions(events);
  const stats = buildMemberStats({ sessions, events, userId, options: { fromMs, toMs, nowMs, timeZone } });

  const users = userNames(db, guild.id);
  const channels = channelNames(db, guild.id);
  const user = (id: string): NamedRef => ({ id, name: users.get(id) ?? `Membre ${id.slice(-4)}` });
  const channel = (id: string): NamedRef => ({ id, name: channels.get(id) ?? `Salon ${id.slice(-4)}` });

  const { userId: _userId, channels: statChannels, together, longestSession, voiceStates, group, ...rest } = stats;
  return {
    ...rest,
    group: restricted ? { ...group, mutedShare: null } : group,
    restricted,
    voiceStates: restricted ? null : voiceStates,
    guild,
    user: user(userId),
    period,
    fromMs,
    toMs,
    timeZone,
    generatedAtMs: nowMs,
    longestSession: longestSession ? { channel: channel(longestSession.channelId), startMs: longestSession.startMs, durationMs: longestSession.durationMs } : null,
    channels: statChannels.map((entry) => ({ channel: channel(entry.channelId), totalMs: entry.totalMs })),
    together: {
      withOthersMs: together.withOthersMs,
      aloneMs: together.aloneMs,
      top: together.top.map((entry) => ({ user: user(entry.userId), ms: entry.ms })),
    },
  };
}
