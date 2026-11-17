import { describe, expect, it } from 'vitest';
import { overlapMs, pairKey, togetherByPair } from './together.ts';
import type { Session } from './types.ts';

const s = (userId: string, channelId: string, startMs: number, endMs: number | null, guildId = 'g1'): Session => ({
  guildId,
  userId,
  channelId,
  startMs,
  endMs,
});

describe('overlapMs', () => {
  it('returns the overlapping time in the same channel', () => {
    expect(overlapMs(s('a', 'c1', 0, 100), s('b', 'c1', 40, 200), 1000)).toBe(60);
  });

  it('returns 0 for different channels or guilds', () => {
    expect(overlapMs(s('a', 'c1', 0, 100), s('b', 'c2', 0, 100), 1000)).toBe(0);
    expect(overlapMs(s('a', 'c1', 0, 100), s('b', 'c1', 0, 100, 'g2'), 1000)).toBe(0);
  });

  it('returns 0 when sessions do not touch', () => {
    expect(overlapMs(s('a', 'c1', 0, 100), s('b', 'c1', 100, 200), 1000)).toBe(0);
  });

  it('measures open sessions up to now', () => {
    expect(overlapMs(s('a', 'c1', 0, null), s('b', 'c1', 600, null), 1000)).toBe(400);
  });
});

describe('togetherByPair', () => {
  it('sums overlaps per unordered pair across sessions', () => {
    const totals = togetherByPair(
      [
        s('a', 'c1', 0, 100),
        s('b', 'c1', 50, 150),
        s('a', 'c2', 200, 300),
        s('b', 'c2', 200, 250),
        s('c', 'c1', 0, 10),
      ],
      1000,
    );
    expect(totals.get(pairKey('a', 'b'))).toBe(50 + 50);
    expect(totals.get(pairKey('a', 'c'))).toBe(10);
    expect(totals.get(pairKey('b', 'c'))).toBeUndefined();
  });

  it('uses the same key whatever the order of the users', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });

  it('never pairs a user with themselves', () => {
    const totals = togetherByPair([s('a', 'c1', 0, 100), s('a', 'c1', 50, 150)], 1000);
    expect(totals.size).toBe(0);
  });
});
