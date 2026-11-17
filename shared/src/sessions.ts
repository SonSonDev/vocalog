import type { Session, VoiceEvent } from './types.ts';

/**
 * Builds sessions from the raw event journal.
 * Events may arrive unsorted; state-only events (mute, deaf, stream...) that keep the
 * same channel do not split a session; a leave with no open session is ignored.
 */
export function deriveSessions(events: readonly VoiceEvent[]): Session[] {
  const sorted = [...events].sort((a, b) => a.atMs - b.atMs);
  const open = new Map<string, Session>();
  const done: Session[] = [];

  for (const event of sorted) {
    const key = `${event.guildId}:${event.userId}`;
    const current = open.get(key);
    if (current && event.channelId === current.channelId) continue;
    if (current) {
      done.push({ ...current, endMs: event.atMs });
      open.delete(key);
    }
    if (event.channelId !== null) {
      open.set(key, {
        guildId: event.guildId,
        userId: event.userId,
        channelId: event.channelId,
        startMs: event.atMs,
        endMs: null,
      });
    }
  }

  return [...done, ...open.values()].sort((a, b) => a.startMs - b.startMs);
}

/** Length of a session; an open session is measured up to `nowMs`. Never negative. */
export function durationMs(session: Session, nowMs: number): number {
  return Math.max(0, (session.endMs ?? nowMs) - session.startMs);
}

/** Total voice time per user id (all channels), summed over the given sessions. */
export function totalByUser(sessions: readonly Session[], nowMs: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.userId, (totals.get(session.userId) ?? 0) + durationMs(session, nowMs));
  }
  return totals;
}
