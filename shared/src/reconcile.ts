import type { LiveVoiceState, Session, VoiceEvent } from './types.ts';

/**
 * Plans the synthetic events needed after a bot restart.
 *
 * - A session still open in the journal whose user is no longer in that channel is closed
 *   at the last heartbeat (never later than `nowMs`, never before the session start), so a
 *   long outage does not become a fake long session.
 * - A user in voice with no matching open session gets a join at `nowMs`.
 */
export function planReconcile(
  openSessions: readonly Session[],
  live: readonly LiveVoiceState[],
  lastHeartbeatMs: number | null,
  nowMs: number,
): VoiceEvent[] {
  const liveByUser = new Map<string, LiveVoiceState>();
  for (const state of live) liveByUser.set(`${state.guildId}:${state.userId}`, state);

  const events: VoiceEvent[] = [];
  const stillOpen = new Set<string>();

  for (const session of openSessions) {
    const key = `${session.guildId}:${session.userId}`;
    const current = liveByUser.get(key);
    if (current && current.channelId === session.channelId) {
      stillOpen.add(key);
      continue;
    }
    const closeAt = Math.min(nowMs, Math.max(session.startMs, lastHeartbeatMs ?? session.startMs));
    events.push({
      guildId: session.guildId,
      userId: session.userId,
      channelId: null,
      kind: 'leave',
      atMs: closeAt,
      source: 'reconcile',
      flags: 0,
    });
  }

  for (const state of live) {
    const key = `${state.guildId}:${state.userId}`;
    if (stillOpen.has(key)) continue;
    events.push({
      guildId: state.guildId,
      userId: state.userId,
      channelId: state.channelId,
      kind: 'join',
      atMs: nowMs,
      source: 'reconcile',
      flags: state.flags,
    });
  }

  return events;
}
