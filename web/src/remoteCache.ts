/**
 * Answers of the JSON API, kept in memory for the life of the page. Three jobs:
 * - going back to something already seen (the previous day, the period you just left) shows it at once;
 * - a request that is already running is shared, so a prefetch and the click that follows make a single call;
 * - an answer older than `FRESH_MS` is still shown at once but fetched again in the background.
 * The server also caches (per minute), so a refresh is cheap. Nothing here outlives a reload or a logout.
 */
export const FRESH_MS = 30_000;
const MAX_ENTRIES = 60;

interface Entry {
  data: unknown;
  at: number;
}

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function peek<T>(key: string): { data: T; at: number } | null {
  const entry = entries.get(key);
  return entry ? (entry as { data: T; at: number }) : null;
}

export function isFresh(key: string, now: number = Date.now()): boolean {
  const entry = entries.get(key);
  return entry !== undefined && now - entry.at < FRESH_MS;
}

/** Fetches `key` unless the same request is already running; the answer is stored, the oldest entry dropped past the limit. */
export function fetchInto<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const promise = load()
    .then((data) => {
      entries.delete(key);
      entries.set(key, { data, at: Date.now() });
      if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Starts loading `key` ahead of the click (hover, focus, neighbours). Silent: a failure just means nothing is ready. */
export function prefetch<T>(key: string, load: () => Promise<T>): void {
  if (isFresh(key) || inflight.has(key)) return;
  fetchInto(key, load).catch(() => undefined);
}

/** Test and logout use only. */
export function clearCache(): void {
  entries.clear();
  inflight.clear();
}
