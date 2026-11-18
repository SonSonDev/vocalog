import { afterEach, describe, expect, it } from 'vitest';
import { FRESH_MS, clearCache, fetchInto, isFresh, peek, prefetch } from './remoteCache.ts';

afterEach(clearCache);

describe('remoteCache', () => {
  it('stores an answer and says it is fresh, then not fresh after a while', async () => {
    await fetchInto('a', async () => 1);
    expect(peek<number>('a')?.data).toBe(1);
    expect(isFresh('a')).toBe(true);
    expect(isFresh('a', Date.now() + FRESH_MS + 1)).toBe(false);
    expect(isFresh('missing')).toBe(false);
  });

  it('shares a request that is already running', async () => {
    let calls = 0;
    let release!: (value: number) => void;
    const slow = () => new Promise<number>((resolve) => ((calls += 1), (release = resolve)));
    const first = fetchInto('a', slow);
    const second = fetchInto('a', slow);
    release(7);
    expect(await first).toBe(7);
    expect(await second).toBe(7);
    expect(calls).toBe(1);
  });

  it('prefetch fills the cache once and never throws', async () => {
    let calls = 0;
    prefetch('a', async () => (calls++, 5));
    prefetch('a', async () => (calls++, 5)); // running: ignored
    await fetchInto('a', async () => 5);
    expect(peek<number>('a')?.data).toBe(5);
    prefetch('a', async () => (calls++, 5)); // fresh: ignored
    expect(calls).toBe(1);

    prefetch('bad', async () => {
      throw new Error('boom');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(peek('bad')).toBeNull();
  });

  it('does not keep a failed request, so it can be tried again', async () => {
    await expect(
      fetchInto('a', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(peek('a')).toBeNull();
    expect(await fetchInto('a', async () => 2)).toBe(2);
  });

  it('stays bounded, dropping the oldest', async () => {
    for (let i = 0; i < 70; i++) await fetchInto(`k${i}`, async () => i);
    expect(peek('k0')).toBeNull();
    expect(peek<number>('k69')?.data).toBe(69);
  });
});
