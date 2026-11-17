import { deriveSessions, planReconcile } from '@vocalog/shared';
import type { LiveVoiceState, VoiceEvent } from '@vocalog/shared';
import type { Db } from './db.ts';
import { insertEvent, lastHeartbeat, loadEvents } from './store.ts';

/**
 * Brings the journal in line with who is really in voice right now (run at startup).
 * Returns the synthetic events that were written.
 */
export function reconcileJournal(db: Db, live: readonly LiveVoiceState[], nowMs: number): VoiceEvent[] {
  const open = deriveSessions(loadEvents(db)).filter((session) => session.endMs === null);
  const planned = planReconcile(open, live, lastHeartbeat(db), nowMs);
  db.transaction(() => {
    for (const event of planned) insertEvent(db, event, { reason: 'startup-reconcile' });
  })();
  return planned;
}
