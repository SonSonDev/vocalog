import { describe, expect, it } from 'vitest';
import { chooseView } from './useRemote.ts';

describe('chooseView', () => {
  it('is idle without a key', () => {
    expect(chooseView({ key: null, entry: null, held: null, failed: false })).toEqual({ data: null, status: 'idle', stale: false });
  });

  it('shows the answer of this exact key as soon as it is known', () => {
    expect(chooseView({ key: 'a', entry: 'new', held: 'old', failed: false })).toEqual({ data: 'new', status: 'ready', stale: false });
  });

  it('keeps the older answer of the same scope, marked stale, while the new one loads', () => {
    expect(chooseView({ key: 'a', entry: null, held: 'old', failed: false })).toEqual({ data: 'old', status: 'ready', stale: true });
  });

  it('shows a loading state, not another page, when nothing of this scope was seen', () => {
    expect(chooseView({ key: 'a', entry: null, held: null, failed: false })).toEqual({ data: null, status: 'loading', stale: false });
  });

  it('reports an error only when nothing can be shown', () => {
    expect(chooseView({ key: 'a', entry: null, held: null, failed: true }).status).toBe('error');
    expect(chooseView({ key: 'a', entry: 'cached', held: null, failed: true }).status).toBe('ready');
  });
});
