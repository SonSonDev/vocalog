/**
 * Knowing when the collector could not see events.
 *
 * The journal only stays right if (a) the heartbeat is written only while events are really flowing, and
 * (b) after a loss of connection the server is resynchronised, closing sessions at the moment the loss began.
 */

/** discord.js `Status.Ready`. */
const WS_READY = 0;

/**
 * True when it is safe to write a heartbeat: the gateway connection is ready and every watched server is
 * available. A heartbeat written during an outage would make a later restart close sessions too late.
 */
export function shouldWriteHeartbeat(wsStatus: number, watchedGuildsAvailable: readonly boolean[]): boolean {
  return wsStatus === WS_READY && watchedGuildsAvailable.every(Boolean);
}

export interface LossTracker {
  /** Remembers that events may have been missed from `nowMs` on. The earliest time wins. */
  markLost(guildIds: Iterable<string>, nowMs: number): void;
  /** Forgets every loss: the connection was resumed and Discord replayed what was missed. */
  clearAll(): void;
  /** The moment the server was lost, removed from the tracker; undefined when it was not marked. */
  take(guildId: string): number | undefined;
}

export function createLossTracker(): LossTracker {
  const lostAt = new Map<string, number>();
  return {
    markLost(guildIds, nowMs) {
      for (const guildId of guildIds) if (!lostAt.has(guildId)) lostAt.set(guildId, nowMs);
    },
    clearAll() {
      lostAt.clear();
    },
    take(guildId) {
      const at = lostAt.get(guildId);
      lostAt.delete(guildId);
      return at;
    },
  };
}
