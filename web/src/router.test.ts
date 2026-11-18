import { describe, expect, it } from 'vitest';
import { buildSearch, dayPath, memberPath, parseRoute, readParams } from './router.ts';

describe('parseRoute', () => {
  it('recognises a day page and only a real-looking date', () => {
    expect(parseRoute('/jours/2026-11-17')).toEqual({ name: 'day', dayKey: '2026-11-17' });
    expect(parseRoute('/jours/2026-11-17/')).toEqual({ name: 'day', dayKey: '2026-11-17' });
    expect(parseRoute('/jours/hier')).toEqual({ name: 'home' });
    expect(dayPath('2026-11-17', '?serveur=1&periode=30d')).toBe('/jours/2026-11-17?serveur=1&periode=30d');
  });

  it('recognises the home page', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/nimporte-quoi')).toEqual({ name: 'home' });
  });

  it('recognises a member page, with or without a trailing slash', () => {
    expect(parseRoute('/membres/123')).toEqual({ name: 'member', userId: '123' });
    expect(parseRoute('/membres/123/')).toEqual({ name: 'member', userId: '123' });
  });

  it('decodes the member id and survives a malformed one', () => {
    expect(parseRoute('/membres/a%20b')).toEqual({ name: 'member', userId: 'a b' });
    expect(parseRoute('/membres/%E0%A4%A')).toEqual({ name: 'home' });
  });

  it('does not treat deeper paths as a member page', () => {
    expect(parseRoute('/membres/1/extra')).toEqual({ name: 'home' });
  });
});

describe('search parameters', () => {
  it('reads a valid server and period', () => {
    expect(readParams('?serveur=g1&periode=7d')).toEqual({ guildId: 'g1', period: '7d' });
  });

  it('ignores an unknown period and returns nulls when absent', () => {
    expect(readParams('?periode=forever')).toEqual({ guildId: null, period: null });
    expect(readParams('')).toEqual({ guildId: null, period: null });
  });

  it('builds a search string and round-trips it', () => {
    const search = buildSearch({ guildId: 'g 1', period: '1y' });
    expect(readParams(search)).toEqual({ guildId: 'g 1', period: '1y' });
  });

  it('omits the server when there is none', () => {
    expect(buildSearch({ guildId: null, period: '30d' })).toBe('?periode=30d');
  });

  it('builds a member path that parses back', () => {
    const path = memberPath('u/1', '?periode=7d');
    expect(path).toBe('/membres/u%2F1?periode=7d');
    expect(parseRoute(path.split('?')[0]!)).toEqual({ name: 'member', userId: 'u/1' });
  });
});
