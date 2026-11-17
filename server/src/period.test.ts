import { describe, expect, it } from 'vitest';
import { isPeriod, periodWindow } from './period.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 18, 12);

describe('isPeriod', () => {
  it('accepts the four periods only', () => {
    expect(['7d', '30d', '1y', 'all'].every(isPeriod)).toBe(true);
    expect(isPeriod('forever')).toBe(false);
    expect(isPeriod('')).toBe(false);
  });
});

describe('periodWindow', () => {
  it('goes back the requested length when the journal is old enough', () => {
    const first = NOW - 400 * DAY;
    expect(periodWindow('7d', NOW, first)).toEqual({ fromMs: NOW - 7 * DAY, toMs: NOW });
    expect(periodWindow('30d', NOW, first)).toEqual({ fromMs: NOW - 30 * DAY, toMs: NOW });
    expect(periodWindow('1y', NOW, first)).toEqual({ fromMs: NOW - 365 * DAY, toMs: NOW });
  });

  it('never starts before the first event', () => {
    const first = NOW - 2 * DAY;
    expect(periodWindow('30d', NOW, first).fromMs).toBe(first);
    expect(periodWindow('1y', NOW, first).fromMs).toBe(first);
    expect(periodWindow('7d', NOW, first).fromMs).toBe(first);
  });

  it('starts "all" at the first event', () => {
    expect(periodWindow('all', NOW, NOW - 40 * DAY).fromMs).toBe(NOW - 40 * DAY);
  });

  it('uses the last day for "all" and the plain length when there is no event', () => {
    expect(periodWindow('all', NOW, null)).toEqual({ fromMs: NOW - DAY, toMs: NOW });
    expect(periodWindow('30d', NOW, null)).toEqual({ fromMs: NOW - 30 * DAY, toMs: NOW });
  });
});
