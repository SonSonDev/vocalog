import { describe, expect, it } from 'vitest';
import { togetherWithUser } from './together.ts';
import type { Session } from './types.ts';

const s = (userId: string, channelId: string, startMs: number, endMs: number | null, guildId = 'g1'): Session => ({
  guildId,
  userId,
  channelId,
  startMs,
  endMs,
});

describe('togetherWithUser', () => {
  it('counts time with at least one other person once, even when several are there', () => {
    const sessions = [s('a', 'c1', 0, 100), s('b', 'c1', 20, 80), s('c', 'c1', 50, 100)];
    const result = togetherWithUser(sessions, 'a', 1000);
    // others are present from 20 to 100: 80 units, not 60 + 50.
    expect(result.withOthersMs).toBe(80);
    expect(result.byUser.get('b')).toBe(60);
    expect(result.byUser.get('c')).toBe(50);
  });

  it('returns zero when the user is always alone', () => {
    const result = togetherWithUser([s('a', 'c1', 0, 100), s('b', 'c2', 0, 100)], 'a', 1000);
    expect(result.withOthersMs).toBe(0);
    expect(result.byUser.size).toBe(0);
  });

  it('sums across several sessions of the user', () => {
    const sessions = [s('a', 'c1', 0, 50), s('a', 'c2', 100, 200), s('b', 'c1', 25, 75), s('b', 'c2', 150, 300)];
    const result = togetherWithUser(sessions, 'a', 1000);
    expect(result.withOthersMs).toBe(25 + 50);
    expect(result.byUser.get('b')).toBe(25 + 50);
  });

  it('measures open sessions up to now', () => {
    const result = togetherWithUser([s('a', 'c1', 0, null), s('b', 'c1', 600, null)], 'a', 1000);
    expect(result.withOthersMs).toBe(400);
  });

  it('keeps servers apart', () => {
    const result = togetherWithUser([s('a', 'c1', 0, 100), s('b', 'c1', 0, 100, 'g2')], 'a', 1000);
    expect(result.withOthersMs).toBe(0);
  });
});
