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
  return buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
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
  it('returns totals, members and channels with names', async () => {
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
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    const body = (await app.inject('/api/guilds/g1/summary')).json();
    expect(body.members[0].user.name).toBe('Membre 1234');
    expect(body.channels[0].channel.name).toBe('Salon 5678');
  });

  it('answers with empty statistics for a server with no events', async () => {
    const db = testDb();
    addNames(db);
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
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
    expect(body.user).toEqual({ id: 'u1', name: 'Alex', handle: 'Alex' });
    expect(body.guild).toEqual({ id: 'g1', name: 'Test server' });
    expect(body.totalMs).toBe(3 * HOUR);
    expect(body.together.withOthersMs).toBe(HOUR);
    expect(body.together.aloneMs).toBe(2 * HOUR);
    expect(body.together.top).toEqual([{ user: { id: 'u2', name: 'Sam', handle: 'Sam' }, ms: HOUR }]);
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
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });

    const onG1 = (await app.inject('/api/guilds/g1/summary')).json();
    expect(onG1.members[0].user.name).toBe('Alexandre');
    const profile = (await app.inject('/api/guilds/g1/members/u1')).json();
    expect(profile.user.name).toBe('Alexandre');

    const onG2 = (await app.inject('/api/guilds/g2/summary')).json();
    expect(onG2.members[0].user.name).toBe('Alex'); // username: no display name stored for g2
  });
});

describe('the @handle next to a name', () => {
  it('returns the Discord username as a handle, separate from the name shown on the server', async () => {
    const db = testDb();
    addNames(db);
    db.prepare("INSERT INTO members (guild_id, user_id, display_name, is_bot, updated_ms) VALUES ('g1', 'u1', 'Alexandre', 0, 0)").run();
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 5 * HOUR });
    addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'join', atMs: NOW - 4 * HOUR });
    addEvent(db, { userId: 'u2', channelId: null, kind: 'leave', atMs: NOW - 3 * HOUR });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 2 * HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });

    const summary = (await app.inject('/api/guilds/g1/summary')).json();
    const alex = summary.members.find((m: { user: { id: string } }) => m.user.id === 'u1').user;
    expect(alex).toEqual({ id: 'u1', name: 'Alexandre', handle: 'Alex' });

    const profile = (await app.inject('/api/guilds/g1/members/u1')).json();
    expect(profile.user).toEqual({ id: 'u1', name: 'Alexandre', handle: 'Alex' });
    // The friends list carries handles too.
    expect(profile.together.top[0].user).toMatchObject({ id: 'u2', name: 'Sam', handle: 'Sam' });
  });

  it('has no handle for someone with no stored username', async () => {
    const db = testDb();
    addNames(db);
    addEvent(db, { userId: 'u-unknown-1234', channelId: 'c1', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { userId: 'u-unknown-1234', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    const member = (await app.inject('/api/guilds/g1/summary')).json().members[0].user;
    expect(member.name).toBe('Membre 1234');
    expect(member.handle).toBeUndefined();
  });
});

describe('answer cache', () => {
  it('shows a new event at once, because the journal grew', async () => {
    const db = testDb();
    addNames(db);
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 5 * HOUR });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 4 * HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    expect((await app.inject('/api/guilds/g1/summary?period=7d')).json().totals.totalMs).toBe(HOUR);
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 3 * HOUR });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 2 * HOUR });
    expect((await app.inject('/api/guilds/g1/summary?period=7d')).json().totals.totalMs).toBe(2 * HOUR);
  });
});

describe('failures', () => {
  it('answers 500 with a generic body and logs the route without its query', async () => {
    const db = testDb();
    addNames(db);
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    db.close(); // every query now throws
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const response = await app.inject('/api/guilds/g1/summary?period=7d&code=secret-code');
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'internal error' });
    } finally {
      console.error = original;
    }
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).not.toContain('secret-code');
    expect(String(logged[0]?.[0])).toContain('/api/guilds/g1/summary');
  });

  it('keeps the message of a client error', async () => {
    const response = await seeded().inject({ method: 'POST', url: '/api/guilds', payload: 'x' });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /api/guilds/:guildId/days/:dayKey', () => {
  it('gives who was in voice that day, with spans, names and neighbouring days', async () => {
    const response = await seeded().inject('/api/guilds/g1/days/2026-11-17');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.guild.id).toBe('g1');
    expect(body.totalMs).toBe(4 * HOUR);
    expect(body.members.map((m: { user: { name: string } }) => m.user.name)).toEqual(['Alex', 'Sam']);
    expect(body.members[0].spans).toEqual([{ channel: { id: 'c1', name: 'General' }, startMs: NOW - 5 * HOUR, endMs: NOW - 2 * HOUR }]);
    expect(body.peak.count).toBe(2);
    expect(body.prevDayKey).toBeNull(); // the first event is on that day
    expect(body.nextDayKey).toBeNull(); // and it is today
    expect(body.bins).toHaveLength(96);
  });

  it('gives each member the stretches of screen sharing, microphone off and headphones off', async () => {
    const db = testDb();
    addNames(db);
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 5 * HOUR });
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'state', atMs: NOW - 4 * HOUR, flags: 1 | 16 });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 3 * HOUR });
    addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'join', atMs: NOW - 4 * HOUR });
    addEvent(db, { userId: 'u2', channelId: null, kind: 'leave', atMs: NOW - 3 * HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    const body = (await app.inject('/api/guilds/g1/days/2026-11-17')).json();
    const [alex, sam] = body.members;
    expect(alex.states).toEqual({
      share: [{ startMs: NOW - 4 * HOUR, endMs: NOW - 3 * HOUR }],
      mute: [{ startMs: NOW - 4 * HOUR, endMs: NOW - 3 * HOUR }],
      deaf: [],
    });
    expect(sam.states).toEqual({ share: [], mute: [], deaf: [] });
  });

  it('answers an empty day without failing', async () => {
    const response = await seeded().inject('/api/guilds/g1/days/2026-11-16');
    expect(response.statusCode).toBe(200);
    expect(response.json().members).toEqual([]);
    expect(response.json().nextDayKey).toBe('2026-11-17');
  });

  it('refuses a bad date, a day in the future and an unknown server', async () => {
    const app = seeded();
    expect((await app.inject('/api/guilds/g1/days/2026-02-30')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/days/..%2Fsecret')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/days/2026-11-18')).statusCode).toBe(404);
    expect((await app.inject('/api/guilds/nope/days/2026-11-17')).statusCode).toBe(404);
  });
});

describe('summary days', () => {
  it('lists one presence strip per day of the period, newest first', async () => {
    const body = (await seeded().inject('/api/guilds/g1/summary?period=7d')).json();
    expect(body.days[0].dayKey).toBe('2026-11-17');
    expect(body.days[0].people).toBe(2);
    expect(body.days[0].peak).toBe(2);
    expect(body.days[0].bins).toHaveLength(48);
    expect(body.days.length).toBeLessThanOrEqual(31);
  });
});

describe('avatars', () => {
  const HASH = 'a'.repeat(32);
  const ID = '123456789012345678';
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  function withAvatar(fetchFn: typeof fetch, avatar: string | null = HASH) {
    const db = testDb();
    addNames(db);
    db.prepare('UPDATE users SET id = ?, avatar = ? WHERE id = ?').run(ID, avatar, 'u1');
    addEvent(db, { userId: ID, channelId: 'c1', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { userId: ID, channelId: null, kind: 'leave', atMs: NOW - HOUR });
    return buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW, fetch: fetchFn });
  }
  const pngResponse = () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });

  it('fetches the picture from Discord, serves it and lets the browser keep it', async () => {
    const urls: string[] = [];
    const app = withAvatar((async (url: string) => (urls.push(url), pngResponse())) as unknown as typeof fetch);
    const response = await app.inject(`/api/guilds/g1/avatars/${ID}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('private, max-age=86400');
    expect(urls).toEqual([`https://cdn.discordapp.com/avatars/${ID}/${HASH}.png?size=64`]);
    await app.inject(`/api/guilds/g1/avatars/${ID}`);
    expect(urls).toHaveLength(1); // served from memory the second time
  });

  it('exposes the hash in the member lists so the page can ask for the picture', async () => {
    const app = withAvatar((async () => pngResponse()) as unknown as typeof fetch);
    const body = (await app.inject('/api/guilds/g1/summary?period=7d')).json();
    expect(body.members.find((m: { user: { id: string } }) => m.user.id === ID).user.avatar).toBe(HASH);
  });

  it('answers 404 without calling Discord for no avatar, an unsafe hash or an unknown member', async () => {
    let calls = 0;
    const spy = (async () => (calls++, pngResponse())) as unknown as typeof fetch;
    expect((await withAvatar(spy, null).inject(`/api/guilds/g1/avatars/${ID}`)).statusCode).toBe(404);
    expect((await withAvatar(spy, '../../x').inject(`/api/guilds/g1/avatars/${ID}`)).statusCode).toBe(404);
    expect((await withAvatar(spy).inject('/api/guilds/g1/avatars/999999999999999999')).statusCode).toBe(404);
    expect((await withAvatar(spy).inject(`/api/guilds/nope/avatars/${ID}`)).statusCode).toBe(404);
    expect(calls).toBe(0);
  });

  it('answers 404 when Discord fails, sends something that is not a PNG, or redirects, and does not retry at once', async () => {
    for (const bad of [
      () => new Response('nope', { status: 500 }),
      () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      () => {
        throw new TypeError('redirect mode is set to error');
      },
    ]) {
      let calls = 0;
      const app = withAvatar((async () => (calls++, bad())) as unknown as typeof fetch);
      expect((await app.inject(`/api/guilds/g1/avatars/${ID}`)).statusCode).toBe(404);
      expect((await app.inject(`/api/guilds/g1/avatars/${ID}`)).statusCode).toBe(404);
      expect(calls).toBe(1);
    }
  });

  it('still works on a database made before the avatar column existed', async () => {
    const db = testDb();
    addNames(db);
    db.exec('ALTER TABLE users DROP COLUMN avatar');
    addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    const body = (await app.inject('/api/guilds/g1/summary?period=7d')).json();
    expect(body.members[0].user.avatar).toBeUndefined();
    expect((await app.inject('/api/guilds/g1/avatars/u1')).statusCode).toBe(404);
  });
});

describe('server icon', () => {
  const GUILD = '123456789012345679';
  const HASH = 'b'.repeat(32);
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const pngResponse = () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });

  function withIcon(fetchFn: typeof fetch, icon: string | null = HASH) {
    const db = testDb();
    db.prepare('INSERT INTO guilds (id, name, icon, updated_ms) VALUES (?, ?, ?, 0)').run(GUILD, 'Icon server', icon);
    addEvent(db, { guildId: GUILD, userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 2 * HOUR });
    addEvent(db, { guildId: GUILD, userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - HOUR });
    return buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW, fetch: fetchFn });
  }

  it('lists the icon hash with the server and serves the picture from Discord, kept by the browser', async () => {
    const urls: string[] = [];
    const app = withIcon((async (url: string) => (urls.push(url), pngResponse())) as unknown as typeof fetch);
    expect((await app.inject('/api/guilds')).json()).toEqual([{ id: GUILD, name: 'Icon server', icon: HASH }]);
    const response = await app.inject(`/api/guilds/${GUILD}/icon`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('private, max-age=86400');
    expect(urls).toEqual([`https://cdn.discordapp.com/icons/${GUILD}/${HASH}.png?size=64`]);
  });

  it('answers 404 without calling Discord for no icon, an unsafe hash or an unknown server', async () => {
    let calls = 0;
    const spy = (async () => (calls++, pngResponse())) as unknown as typeof fetch;
    expect((await withIcon(spy, null).inject(`/api/guilds/${GUILD}/icon`)).statusCode).toBe(404);
    expect((await withIcon(spy, '../../x').inject(`/api/guilds/${GUILD}/icon`)).statusCode).toBe(404);
    expect((await withIcon(spy).inject('/api/guilds/nope/icon')).statusCode).toBe(404);
    expect(calls).toBe(0);
  });

  it('works on a database made before the icon column existed', async () => {
    const db = testDb();
    addNames(db);
    db.exec('ALTER TABLE guilds DROP COLUMN icon');
    const app = buildApp({ db, timeZone: 'UTC', webDir: null, auth: { mode: 'none' }, now: () => NOW });
    expect((await app.inject('/api/guilds')).json()).toEqual([
      { id: 'g2', name: 'Other server' },
      { id: 'g1', name: 'Test server' },
    ]);
    expect((await app.inject('/api/guilds/g1/icon')).statusCode).toBe(404);
  });
});

describe('GET /api/guilds/:guildId/weeks/:startKey', () => {
  it('gives who was in voice that week, most time first, with the days, hours and names', async () => {
    const response = await seeded().inject('/api/guilds/g1/weeks/2026-11-16');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.guild.id).toBe('g1');
    expect(body.members.map((m: { user: { name: string }; totalMs: number }) => [m.user.name, m.totalMs])).toEqual([
      ['Alex', 3 * HOUR],
      ['Sam', HOUR],
    ]);
    expect(body.members[0].spans).toEqual([{ channel: { id: 'c1', name: 'General' }, startMs: NOW - 5 * HOUR, endMs: NOW - 2 * HOUR }]);
    expect(body.days).toHaveLength(7);
    expect(body.days[1]).toMatchObject({ dayKey: '2026-11-17', totalMs: 4 * HOUR });
    expect(body.totalMs).toBe(4 * HOUR);
    expect(body.bins).toHaveLength(168);
    expect(body.prevStartKey).toBeNull(); // the first event is in this week
    expect(body.nextStartKey).toBeNull(); // and it is the current week
  });

  it('answers an earlier empty week, with its neighbour', async () => {
    const body = (await seeded().inject('/api/guilds/g1/weeks/2026-11-09')).json();
    expect(body.members).toEqual([]);
    expect(body.nextStartKey).toBe('2026-11-16');
  });

  it('refuses a date that is not a Monday, a bad date, a week in the future and an unknown server', async () => {
    const app = seeded();
    expect((await app.inject('/api/guilds/g1/weeks/2026-11-17')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/weeks/..%2Fsecret')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/weeks/2026-11-23')).statusCode).toBe(404);
    expect((await app.inject('/api/guilds/nope/weeks/2026-11-16')).statusCode).toBe(404);
  });
});

describe('GET /api/guilds/:guildId/months/:monthKey', () => {
  it('gives the month as a calendar with its totals and busiest day', async () => {
    const body = (await seeded().inject('/api/guilds/g1/months/2026-11')).json();
    expect(body.totalMs).toBe(4 * HOUR);
    expect(body.people).toBe(2);
    expect(body.activeDays).toBe(1);
    expect(body.busiest).toEqual({ dayKey: '2026-11-17', totalMs: 4 * HOUR });
    expect(body.weeks[0].startKey).toBe('2026-10-26'); // 1 November 2026 is a Sunday
    expect(body.weeks.every((week: { days: unknown[] }) => week.days.length === 7)).toBe(true);
    expect(body.prevMonthKey).toBeNull();
    expect(body.nextMonthKey).toBeNull();
  });

  it('answers an earlier empty month, with its neighbour', async () => {
    const body = (await seeded().inject('/api/guilds/g1/months/2026-10')).json();
    expect(body.activeDays).toBe(0);
    expect(body.busiest).toBeNull();
    expect(body.nextMonthKey).toBe('2026-11');
  });

  it('refuses a bad month, a month in the future and an unknown server', async () => {
    const app = seeded();
    expect((await app.inject('/api/guilds/g1/months/2026-13')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/months/2026-11-01')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/months/2026-12')).statusCode).toBe(404);
    expect((await app.inject('/api/guilds/nope/months/2026-11')).statusCode).toBe(404);
  });
});

describe('summary weeks and months', () => {
  it('lists the weeks and months of the period, newest first', async () => {
    const body = (await seeded().inject('/api/guilds/g1/summary?period=7d')).json();
    expect(body.weeks[0]).toMatchObject({ startKey: '2026-11-16', people: 2, peak: 2 });
    expect(body.weeks[0].bins).toHaveLength(168);
    expect(body.weeks[0].dayTotals).toHaveLength(7);
    expect(body.months[0]).toMatchObject({ monthKey: '2026-11', people: 2 });
    expect(body.months[0].dayTotals).toHaveLength(30);
    expect(body.weeks.length).toBeLessThanOrEqual(12);
  });
});

describe('GET /api/guilds/:guildId/years/:yearKey', () => {
  it('gives the year as twelve months of days, with its records', async () => {
    const body = (await seeded().inject('/api/guilds/g1/years/2026')).json();
    expect(body.guild.id).toBe('g1');
    expect(body.months).toHaveLength(12);
    expect(body.totalMs).toBe(4 * HOUR);
    expect(body.activeDays).toBe(1);
    expect(body.busiestDay).toEqual({ dayKey: '2026-11-17', totalMs: 4 * HOUR });
    expect(body.busiestMonth).toEqual({ monthKey: '2026-11', totalMs: 4 * HOUR });
    expect(body.longestStreak).toEqual({ days: 1, startKey: '2026-11-17', endKey: '2026-11-17' });
    expect(body.months[10].days).toHaveLength(30);
    expect(body.prevYearKey).toBeNull();
    expect(body.nextYearKey).toBeNull();
  });

  it('answers an earlier empty year with its neighbour, and refuses bad or future years and unknown servers', async () => {
    const app = seeded();
    const earlier = (await app.inject('/api/guilds/g1/years/2025')).json();
    expect(earlier.activeDays).toBe(0);
    expect(earlier.nextYearKey).toBe('2026');
    expect((await app.inject('/api/guilds/g1/years/26')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/years/2026-11')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/years/2027')).statusCode).toBe(404);
    expect((await app.inject('/api/guilds/nope/years/2026')).statusCode).toBe(404);
  });

  it('is listed in the summary as one strip per year', async () => {
    const body = (await seeded().inject('/api/guilds/g1/summary?period=7d')).json();
    expect(body.years[0]).toMatchObject({ yearKey: '2026', people: 2 });
    expect(body.years[0].monthTotals).toHaveLength(12);
    expect(body.years[0].monthTotals[10]).toBe(4 * HOUR);
  });
});

describe('member year grid', () => {
  it('gives a member their voice time on each of the last 53 weeks, whatever the period', async () => {
    const app = seeded();
    for (const period of ['7d', '30d', 'all']) {
      const body = (await app.inject(`/api/guilds/g1/members/u1?period=${period}`)).json();
      expect(body.yearGrid.totals).toHaveLength(371);
      expect(body.yearGrid.startKey).toBe('2025-11-17'); // 52 weeks before the Monday of the current week
      expect(body.yearGrid.elapsedDays).toBe(366); // up to Tuesday 17 November 2026 included
      const today = body.yearGrid.totals[body.yearGrid.elapsedDays - 1];
      expect(today).toBe(3 * HOUR); // u1 was in voice from 07:00 to 10:00
      expect(body.yearGrid.totals.reduce((sum: number, value: number) => sum + value, 0)).toBe(3 * HOUR);
    }
  });

  it('counts only that member', async () => {
    const body = (await seeded().inject('/api/guilds/g1/members/u2?period=30d')).json();
    expect(body.yearGrid.totals.reduce((sum: number, value: number) => sum + value, 0)).toBe(HOUR);
  });
});

describe('summary year grid', () => {
  it('gives the group its voice time on each of the last 53 weeks, whatever the period', async () => {
    const app = seeded();
    for (const period of ['7d', '30d', 'all']) {
      const body = (await app.inject(`/api/guilds/g1/summary?period=${period}`)).json();
      expect(body.yearGrid.totals).toHaveLength(371);
      expect(body.yearGrid.startKey).toBe('2025-11-17');
      expect(body.yearGrid.totals[body.yearGrid.elapsedDays - 1]).toBe(4 * HOUR); // u1 3 h and u2 1 h, today
      expect(body.yearGrid.totals.reduce((sum: number, value: number) => sum + value, 0)).toBe(4 * HOUR);
    }
  });
});

describe('time zone of a request', () => {
  it('uses the server zone by default and the one asked for with ?tz, in every kind of answer', async () => {
    const app = seeded();
    for (const url of [
      '/api/guilds/g1/summary?period=7d',
      '/api/guilds/g1/members/u1?period=7d',
      '/api/guilds/g1/days/2026-11-17',
      '/api/guilds/g1/weeks/2026-11-16',
      '/api/guilds/g1/months/2026-11',
      '/api/guilds/g1/years/2026',
    ]) {
      const separator = url.includes('?') ? '&' : '?';
      expect((await app.inject(url)).json().timeZone, url).toBe('UTC');
      expect((await app.inject(`${url}${separator}tz=Asia/Tokyo`)).json().timeZone, url).toBe('Asia/Tokyo');
    }
  });

  it('moves the hours of the figures with the zone: 07:00 to 10:00 UTC is 16:00 to 19:00 in Tokyo', async () => {
    const app = seeded();
    const hours = async (query: string): Promise<number[]> => {
      const body = (await app.inject(`/api/guilds/g1/summary?period=7d${query}`)).json();
      return body.members.find((m: { user: { id: string } }) => m.user.id === 'u1').hourMs.map((ms: number) => Math.round(ms / 3_600_000));
    };
    const utc = await hours('');
    const tokyo = await hours('&tz=Asia/Tokyo');
    expect(utc.slice(7, 10)).toEqual([1, 1, 1]);
    expect(tokyo.slice(16, 19)).toEqual([1, 1, 1]);
    expect(tokyo.slice(7, 10)).toEqual([0, 0, 0]);
  });

  it('does not mix the answers of two zones in its cache', async () => {
    const app = seeded();
    const first = (await app.inject('/api/guilds/g1/days/2026-11-17?tz=Pacific/Auckland')).json();
    const second = (await app.inject('/api/guilds/g1/days/2026-11-17')).json();
    expect(first.startMs).not.toBe(second.startMs);
    expect(first.timeZone).toBe('Pacific/Auckland');
    expect(second.timeZone).toBe('UTC');
  });

  it('refuses an unknown zone with a 400, on every route', async () => {
    const app = seeded();
    for (const url of ['/api/guilds/g1/summary', '/api/guilds/g1/members/u1', '/api/guilds/g1/days/2026-11-17', '/api/guilds/g1/weeks/2026-11-16', '/api/guilds/g1/months/2026-11', '/api/guilds/g1/years/2026']) {
      const separator = url.includes('?') ? '&' : '?';
      for (const bad of ['Mars/Olympus', '..%2Fetc', 'Europe/Paris;x']) expect((await app.inject(`${url}${separator}tz=${bad}`)).statusCode, `${url} ${bad}`).toBe(400);
    }
  });

  it('tells the settings menu which zone is the server own', async () => {
    expect((await seeded().inject('/api/me')).json().serverTimeZone).toBe('UTC');
  });
});

describe('weeks that start on Sunday (?ws=sunday)', () => {
  it('serves a week by its Sunday, with the days from Sunday and the neighbours a week apart', async () => {
    const body = (await seeded().inject('/api/guilds/g1/weeks/2026-11-15?ws=sunday')).json();
    expect(body.startKey).toBe('2026-11-15');
    expect(body.days.map((day: { dayKey: string }) => day.dayKey)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
    expect(body.totalMs).toBe(4 * HOUR); // Tuesday 17 November
    expect(body.nextStartKey).toBeNull(); // the current week
    expect(body.prevStartKey).toBeNull(); // the first event is in this week too
  });

  it('refuses the key of the other kind of week, a Monday for Sunday weeks and a Sunday for Monday weeks', async () => {
    const app = seeded();
    expect((await app.inject('/api/guilds/g1/weeks/2026-11-16?ws=sunday')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/weeks/2026-11-15')).statusCode).toBe(400);
    expect((await app.inject('/api/guilds/g1/weeks/2026-11-16')).statusCode).toBe(200);
  });

  it('starts the rows of a month and the cells of a year from Sunday', async () => {
    const app = seeded();
    const month = (await app.inject('/api/guilds/g1/months/2026-11?ws=sunday')).json();
    expect(month.weeks[0].startKey).toBe('2026-11-01');
    const year = (await app.inject('/api/guilds/g1/years/2026?ws=sunday')).json();
    expect(year.months[0].firstWeekday).toBe(4);
    expect((await app.inject('/api/guilds/g1/years/2026')).json().months[0].firstWeekday).toBe(3);
  });

  it('cuts the strips of weeks and the last 53 weeks of the group and of a member on Sundays', async () => {
    const app = seeded();
    const summary = (await app.inject('/api/guilds/g1/summary?period=7d&ws=sunday')).json();
    expect(summary.weeks[0].startKey).toBe('2026-11-15');
    expect(summary.yearGrid.startKey).toBe('2025-11-16');
    const member = (await app.inject('/api/guilds/g1/members/u1?period=7d&ws=sunday')).json();
    expect(member.yearGrid.startKey).toBe('2025-11-16');
    expect((await app.inject('/api/guilds/g1/summary?period=7d')).json().yearGrid.startKey).toBe('2025-11-17');
  });

  it('does not mix the answers of the two kinds of week in its cache', async () => {
    const app = seeded();
    const sunday = (await app.inject('/api/guilds/g1/months/2026-11?ws=sunday')).json();
    const monday = (await app.inject('/api/guilds/g1/months/2026-11')).json();
    expect(sunday.weeks[0].startKey).not.toBe(monday.weeks[0].startKey);
  });

  it('refuses a week start that is neither, on every route that takes one', async () => {
    const app = seeded();
    for (const url of ['/api/guilds/g1/summary', '/api/guilds/g1/members/u1', '/api/guilds/g1/weeks/2026-11-16', '/api/guilds/g1/months/2026-11', '/api/guilds/g1/years/2026']) {
      for (const bad of ['friday', 'Sunday', '1']) expect((await app.inject(`${url}?ws=${bad}`)).statusCode, `${url} ${bad}`).toBe(400);
    }
  });
});
