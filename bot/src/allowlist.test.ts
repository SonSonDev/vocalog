import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowList } from './allowlist.ts';

describe('parseAllowList', () => {
  it('splits, trims and ignores empty items', () => {
    expect([...parseAllowList(' 1, 2 ,,3 ')]).toEqual(['1', '2', '3']);
  });

  it('throws when missing or empty', () => {
    expect(() => parseAllowList(undefined)).toThrow(/ALLOWED_GUILD_IDS/);
    expect(() => parseAllowList('  , ')).toThrow(/ALLOWED_GUILD_IDS/);
  });
});

describe('isAllowed', () => {
  it('accepts only listed servers', () => {
    const allowed = parseAllowList('1,2');
    expect(isAllowed(allowed, '1')).toBe(true);
    expect(isAllowed(allowed, '3')).toBe(false);
  });
});
