import type { Db } from './queries.ts';

const MAX_ENTRIES = 200;
const MINUTE_MS = 60_000;

/**
 * Remembers computed answers. An answer is reused while the journal has not grown (the last `voice_events` id is
 * the same: the journal is append-only, so this check is exact) and the current minute has not changed (open
 * sessions grow with time, and names are refreshed by the bot outside the journal). Answers are the same for every
 * person who may see the server, so the key holds no viewer. Small and bounded: the oldest entry goes first.
 */
export function createCache(db: Db, now: () => number) {
  const lastId = db.prepare('SELECT MAX(id) AS id FROM voice_events');
  const entries = new Map<string, { version: string; value: unknown }>();

  return function cached<T>(key: string, compute: () => T): T {
    const row = lastId.get() as { id: number | null };
    const version = `${row.id ?? 0}:${Math.floor(now() / MINUTE_MS)}`;
    const hit = entries.get(key);
    if (hit && hit.version === version) return hit.value as T;
    const value = compute();
    entries.delete(key);
    entries.set(key, { version, value });
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
    return value;
  };
}
