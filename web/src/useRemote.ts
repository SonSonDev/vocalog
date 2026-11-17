import { useCallback, useEffect, useState } from 'preact/hooks';

export type RemoteStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads data for a `key` (the inputs of the request). While a new key loads, the data of the previous key is not
 * returned, so a page never shows the wrong member for a moment. `retry` reloads after an error.
 */
export function useRemote<T>(key: string | null, load: () => Promise<T>): { data: T | null; status: RemoteStatus; retry: () => void } {
  const [loaded, setLoaded] = useState<{ key: string; data: T } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setFailedKey(null);
    load()
      .then((data) => {
        if (!cancelled) setLoaded({ key, data });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt on every render; the key already identifies its inputs.
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const data = loaded !== null && loaded.key === key ? loaded.data : null;
  const status: RemoteStatus = key === null ? 'idle' : failedKey === key ? 'error' : data !== null ? 'ready' : 'loading';
  return { data, status, retry };
}
