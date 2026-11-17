import { deriveSessions, planReconcile } from '@vocalog/shared';
import type { LiveVoiceState, VoiceEvent } from '@vocalog/shared';
import type { Db } from './db.ts';
import { insertEvent, lastHeartbeat, loadEvents } from './store.ts';

export interface ReconcileOptions {
  /** Only reconcile this server; sessions of other servers are left alone. */
  guildId?: string;
  /** Servers to leave alone (for example servers that are unavailable right now). */
  exceptGuildIds?: ReadonlySet<string>;
  /** The last moment events were certainly being received. Defaults to the last heartbeat. */
  aliveUntilMs?: number | null;
}

/**
 * Brings the journal in line with who is really in voice right now (at startup, and again for a server that
 * became available after a loss of connection). Returns the synthetic events that were written.
 */
export function reconcileJournal(db: Db, live: readonly LiveVoiceState[], nowMs: number, options: ReconcileOptions = {}): VoiceEvent[] {
  const { guildId, exceptGuildIds, aliveUntilMs } = options;
  const inScope = (id: string): boolean => (guildId === undefined || id === guildId) && !exceptGuildIds?.has(id);

  const open = deriveSessions(loadEvents(db)).filter((session) => session.endMs === null && inScope(session.guildId));
  const planned = planReconcile(open, live.filter((state) => inScope(state.guildId)), aliveUntilMs ?? lastHeartbeat(db), nowMs);
  db.transaction(() => {
    for (const event of planned) insertEvent(db, event, { reason: guildId === undefined ? 'startup-reconcile' : 'guild-resync' });
  })();
  return planned;
}
