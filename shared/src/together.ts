import type { Session } from './types.ts';

/** Time two sessions overlap in the same guild and channel. */
export function overlapMs(a: Session, b: Session, nowMs: number): number {
  if (a.guildId !== b.guildId || a.channelId !== b.channelId) return 0;
  const start = Math.max(a.startMs, b.startMs);
  const end = Math.min(a.endMs ?? nowMs, b.endMs ?? nowMs);
  return Math.max(0, end - start);
}

/** Key of an unordered pair of users: ids sorted, joined by `|`. */
export function pairKey(userA: string, userB: string): string {
  return userA < userB ? `${userA}|${userB}` : `${userB}|${userA}`;
}

/** Time spent in the same channel at the same time, for every pair of users. */
export function togetherByPair(sessions: readonly Session[], nowMs: number): Map<string, number> {
  const byChannel = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = `${session.guildId}:${session.channelId}`;
    const list = byChannel.get(key);
    if (list) list.push(session);
    else byChannel.set(key, [session]);
  }

  const totals = new Map<string, number>();
  for (const list of byChannel.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.userId === b.userId) continue;
        const overlap = overlapMs(a, b, nowMs);
        if (overlap === 0) continue;
        const key = pairKey(a.userId, b.userId);
        totals.set(key, (totals.get(key) ?? 0) + overlap);
      }
    }
  }
  return totals;
}
