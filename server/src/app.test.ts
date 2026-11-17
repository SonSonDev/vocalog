import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { addEvent, addNames, testDb } from './test-helpers.ts';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 17, 12); // Tuesday 17 November 2026, 12:00 UTC

function seeded() {
  const db = testDb();
  addNames(db);
  // u1 and u2 overlap for one hour in c1; u1 stays another hour alone.
  addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 5 * HOUR });
  addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'join', atMs: NOW - 4 * HOUR });
  addEvent(db, { userId: 'u2', channelId: null, kind: 'leave', atMs: NOW - 3 * HOUR });
  addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 2 * HOUR });
  // Another server must never leak into g1.
  addEvent(db, { guildId: 'g2', userId: 'u1', channelId: 'c9', kind: 'join', atMs: NOW - 10 * HOUR });
  addEvent(db, { guildId: 'g2', userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 9 * HOUR });
  return buildApp({ db, timeZone: 'UTC', webDir: null, now: () => NOW });
}

describe('GET /api/guilds', () => {
  it('lists servers', async () => {
    const response = await seeded().inject('/api/guilds');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: 'g2', name: 'Other server' },
      { id: 'g1', name: 'Test server' },
    ]);
  });
});

describe('GET /api/guilds/:guildId/summary', () => {
  it('returns totals, members, pairs and channels with names', async () => {
    const response = await seeded().inject('/api/guilds/g1/summary?period=7d');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.guild).toEqual({ id: 'g1', name: 'Test server' });
    expect(body.totals.totalMs).toBe(4 * HOUR); // u1: 3h, u2: 1h
    expect(body.totals.activeMembers).toBe(2);
    expect(body.members.map((m: { user: { name: string }; totalMs: number }) => [m.user.name, m.totalMs])).toEqual([
      ['Alex', 3 * HOUR],
      ['Sam', HOUR],
    ]);
    expect(body.pairs).toBeUndefined();
    expect(body.channels[0].channel.name).toBe('General');
    expect(body.longestSession.user.name).toBe('Alex');
    expect(body.peak.count).toBe(2);
  });

  it('keeps servers separate', async () => {
    const body = (await seeded().inject('/api/guilds/g2/summary')).json();
    expect(body.totals.totalMs).toBe(HOUR);
    expect(body.members).toHaveLength(1);
  });

  it('defaults to 30 days', async () => {
    const body = (await seeded().inject('/api/guilds/g1/summary')).json();
    expect(body.period).toBe('30d');
  });

  it('rejects an unknown period', async () => {
    const response = await seeded().inject('/api/guilds/g1/summary?period=forever');
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for an unknown server', async () => {
    const response = await seeded().inject('/api/guilds/nope/summary');
    expect(response.statusCode).toBe(404);
  });

  it('falls back to a readable name when a user or channel is unknown', async () => {
    const db = testDb();
    addNames(db);
    addEvent(db, { userId: 'u-unknown-1234', channelId: 'c-unknown-5678', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { userId: 'u-unknown-1234', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, now: () => NOW });
    const body = (await app.inject('/api/guilds/g1/summary')).json();
    expect(body.members[0].user.name).toBe('Membre 1234');
    expect(body.channels[0].channel.name).toBe('Salon 5678');
  });

  it('answers with empty statistics for a server with no events', async () => {
    const db = testDb();
    addNames(db);
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, now: () => NOW });
    const body = (await app.inject('/api/guilds/g1/summary?period=all')).json();
    expect(body.totals.totalMs).toBe(0);
    expect(body.members).toEqual([]);
    expect(body.longestSession).toBeNull();
  });
});

describe('unknown routes', () => {
  it('returns JSON 404 for an unknown API path', async () => {
    const response = await seeded().inject('/api/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'not found' });
  });
});

describe('GET /api/guilds/:guildId/members/:userId', () => {
  it('returns the personal profile with names resolved', async () => {
    const response = await seeded().inject('/api/guilds/g1/members/u1?period=7d');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toEqual({ id: 'u1', name: 'Alex' });
    expect(body.guild).toEqual({ id: 'g1', name: 'Test server' });
    expect(body.totalMs).toBe(3 * HOUR);
    expect(body.together.withOthersMs).toBe(HOUR);
    expect(body.together.aloneMs).toBe(2 * HOUR);
    expect(body.together.top).toEqual([{ user: { id: 'u2', name: 'Sam' }, ms: HOUR }]);
    expect(body.channels[0].channel.name).toBe('General');
    expect(body.longestSession.channel.name).toBe('General');
    expect(body.group).toMatchObject({ rank: 1, of: 2 });
    expect(body.activity.buckets.length).toBeGreaterThan(0);
    expect(body.userId).toBeUndefined();
  });

  it('does not mix in another server', async () => {
    const body = (await seeded().inject('/api/guilds/g2/members/u1')).json();
    expect(body.totalMs).toBe(HOUR);
    expect(body.together.top).toEqual([]);
  });

  it('returns 404 for a member with no activity on that server', async () => {
    expect((await seeded().inject('/api/guilds/g1/members/nobody')).statusCode).toBe(404);
    expect((await seeded().inject('/api/guilds/nope/members/u1')).statusCode).toBe(404);
  });

  it('rejects a bad period', async () => {
    expect((await seeded().inject('/api/guilds/g1/members/u1?period=x')).statusCode).toBe(400);
  });
});

describe('names shown on a server', () => {
  it('prefers the name shown on that server and falls back to the username elsewhere', async () => {
    const db = testDb();
    addNames(db);
    db.prepare("INSERT INTO members (guild_id, user_id, display_name, is_bot, updated_ms) VALUES ('g1', 'u1', 'Alexandre', 0, 0)").run();
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    addEvent(db, { guildId: 'g2', userId: 'u1', channelId: 'c9', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { guildId: 'g2', userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, now: () => NOW });

    const onG1 = (await app.inject('/api/guilds/g1/summary')).json();
    expect(onG1.members[0].user.name).toBe('Alexandre');
    const profile = (await app.inject('/api/guilds/g1/members/u1')).json();
    expect(profile.user.name).toBe('Alexandre');

    const onG2 = (await app.inject('/api/guilds/g2/summary')).json();
    expect(onG2.members[0].user.name).toBe('Alex'); // username: no display name stored for g2
  });
});
