import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createCache } from './cache.ts';

function setup() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE voice_events (id INTEGER PRIMARY KEY, at_ms INTEGER)');
  let nowMs = 1_000_000;
  const cached = createCache(db, () => nowMs);
  let calls = 0;
  const compute = () => ++calls;
  return { db, cached, compute, calls: () => calls, advance: (ms: number) => (nowMs += ms) };
}

describe('cache', () => {
  it('reuses an answer while nothing changed', () => {
    const { cached, compute, calls } = setup();
    expect(cached('a', compute)).toBe(1);
    expect(cached('a', compute)).toBe(1);
    expect(calls()).toBe(1);
  });

  it('keeps different keys apart', () => {
    const { cached, compute } = setup();
    expect(cached('a', compute)).toBe(1);
    expect(cached('b', compute)).toBe(2);
  });

  it('recomputes when the journal grows', () => {
    const { db, cached, compute } = setup();
    cached('a', compute);
    db.prepare('INSERT INTO voice_events (at_ms) VALUES (1)').run();
    expect(cached('a', compute)).toBe(2);
  });

  it('recomputes when the minute changes', () => {
    const { cached, compute, advance } = setup();
    cached('a', compute);
    advance(61_000);
    expect(cached('a', compute)).toBe(2);
  });

  it('stays bounded', () => {
    const { cached, compute, calls } = setup();
    for (let i = 0; i < 250; i++) cached(`k${i}`, compute);
    cached('k0', compute); // evicted long ago: computed again
    expect(calls()).toBe(251);
  });
});
