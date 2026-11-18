import type { Session } from './types.ts';

interface Interval {
  startMs: number;
  endMs: number;
}

function unionLength(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let current: Interval | null = null;
  for (const interval of sorted) {
    if (current && interval.startMs <= current.endMs) {
      current.endMs = Math.max(current.endMs, interval.endMs);
    } else {
      if (current) total += current.endMs - current.startMs;
      current = { ...interval };
    }
  }
  if (current) total += current.endMs - current.startMs;
  return total;
}

/**
 * For one user: time spent in a channel with at least one other person (`withOthersMs`, counted once even
 * when several people are there), and time spent in the same channel with each other person.
 * Pass the sessions of one server; they may be clipped to a window beforehand.
 */
export function togetherWithUser(
  sessions: readonly Session[],
  userId: string,
  nowMs: number,
): { withOthersMs: number; byUser: Map<string, number> } {
  const byChannel = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = `${session.guildId}:${session.channelId}`;
    const list = byChannel.get(key);
    if (list) list.push(session);
    else byChannel.set(key, [session]);
  }

  let withOthersMs = 0;
  const byUser = new Map<string, number>();

  for (const own of sessions) {
    if (own.userId !== userId) continue;
    const others = byChannel.get(`${own.guildId}:${own.channelId}`) ?? [];
    const overlaps: Interval[] = [];
    const perUser = new Map<string, Interval[]>();
    for (const other of others) {
      if (other.userId === userId) continue;
      const startMs = Math.max(own.startMs, other.startMs);
      const endMs = Math.min(own.endMs ?? nowMs, other.endMs ?? nowMs);
      if (endMs <= startMs) continue;
      overlaps.push({ startMs, endMs });
      const list = perUser.get(other.userId);
      if (list) list.push({ startMs, endMs });
      else perUser.set(other.userId, [{ startMs, endMs }]);
    }
    withOthersMs += unionLength(overlaps);
    for (const [otherId, intervals] of perUser) {
      byUser.set(otherId, (byUser.get(otherId) ?? 0) + unionLength(intervals));
    }
  }
  return { withOthersMs, byUser };
}
