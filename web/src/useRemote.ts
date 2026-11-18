import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { fetchInto, isFresh, peek } from './remoteCache.ts';

export type RemoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RemoteView<T> {
  data: T | null;
  status: RemoteStatus;
  /** True while an older answer of the same `scope` is shown because the new one is still loading. */
  stale: boolean;
}

/**
 * What to show for a request, as a pure function (tested on its own).
 * - The answer for this exact key, when there is one (even an old one: it is refreshed in the background).
 * - Otherwise the last answer of the same `scope`, marked `stale`: changing the period keeps the page in place, dimmed.
 * - Otherwise nothing (`loading`, or `error` when the request failed): the page shows a skeleton, never the answer of
 *   another member or another day under a new title.
 */
export function chooseView<T>(args: { key: string | null; entry: T | null; held: T | null; failed: boolean }): RemoteView<T> {
  const { key, entry, held, failed } = args;
  if (key === null) return { data: null, status: 'idle', stale: false };
  if (entry !== null) return { data: entry, status: 'ready', stale: false };
  if (failed) return { data: null, status: 'error', stale: false };
  if (held !== null) return { data: held, status: 'ready', stale: true };
  return { data: null, status: 'loading', stale: false };
}

/**
 * Loads data for a `key` (the inputs of the request) through the shared cache. `scope` names what may stay on screen,
 * dimmed, while another key of the same scope loads (for example a member page across periods). `retry` reloads after an error.
 */
export function useRemote<T>(key: string | null, load: () => Promise<T>, scope: string | null = null): RemoteView<T> & { retry: () => void } {
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ scope: string | null; data: T } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setFailedKey(null);
    // A fresh answer needs nothing; an old one is shown at once and fetched again here.
    if (attempt === 0 && isFresh(key)) return;
    fetchInto(key, load)
      .then(() => {
        if (!cancelled) redraw(0);
      })
      .catch(() => {
        if (!cancelled && peek(key) === null) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt on every render; the key already identifies its inputs.
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const entry = key === null ? null : (peek<T>(key)?.data ?? null);
  if (entry !== null) last.current = { scope, data: entry };
  const held = scope !== null && last.current !== null && last.current.scope === scope ? last.current.data : null;
  return { ...chooseView<T>({ key, entry, held, failed: failedKey === key }), retry };
}
