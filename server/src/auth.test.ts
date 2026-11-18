import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { AuthOptions } from './auth.ts';
import { signSession } from './session.ts';
import type { Session } from './session.ts';
import { addEvent, addNames, testDb } from './test-helpers.ts';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 17, 12);
const SECRET = 'a-secret-of-at-least-thirty-two-characters!!';
const ACCESS_TOKEN = 'discord-access-token-that-must-never-leak';
const OAUTH = { clientId: 'client-1', clientSecret: 'client-secret-1', redirectUri: 'https://example.com/auth/callback' };

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** A fake Discord: one person (id u1) who belongs to g1 and to a server Vocalog does not know. */
function fakeDiscord(options: { tokenStatus?: number; guilds?: string[] } = {}) {
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/oauth2/token')) return options.tokenStatus && options.tokenStatus !== 200 ? json({}, options.tokenStatus) : json({ access_token: ACCESS_TOKEN });
    if (url.endsWith('/users/@me/guilds')) return json((options.guilds ?? ['g1', 'g-unknown']).map((id) => ({ id })));
    if (url.endsWith('/users/@me')) return json({ id: 'u1', username: 'alex_42', global_name: 'Alex' });
    return json({}, 404);
  }) as typeof fetch;
  return { fetchFn, calls };
}

function discordAuth(fetchFn: typeof fetch, secure = true): AuthOptions {
  return { mode: 'discord', oauth: OAUTH, sessionSecret: SECRET, secureCookies: secure, fetch: fetchFn, knownGuildIds: () => ['g1', 'g2'] };
}

function app(auth: AuthOptions) {
  const db = testDb();
  addNames(db);
  // u1 and u2 overlap in g1; u1 also has a session in g2.
  addEvent(db, { userId: 'u1', channelId: 'c1', kind: 'join', atMs: NOW - 5 * HOUR });
  addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'join', atMs: NOW - 4 * HOUR });
  addEvent(db, { userId: 'u2', channelId: null, kind: 'leave', atMs: NOW - 3 * HOUR });
  addEvent(db, { userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 2 * HOUR });
  addEvent(db, { guildId: 'g2', userId: 'u1', channelId: 'c9', kind: 'join', atMs: NOW - 10 * HOUR });
  addEvent(db, { guildId: 'g2', userId: 'u1', channelId: null, kind: 'leave', atMs: NOW - 9 * HOUR });
  // u2 mutes themselves for 30 minutes, so the restricted view has something real to hide.
  addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'state', atMs: NOW - 4 * HOUR + 30 * 60_000, flags: 1 });
  addEvent(db, { userId: 'u2', channelId: 'c1', kind: 'state', atMs: NOW - 4 * HOUR + 60 * 60_000, flags: 0 });
  return buildApp({ db, timeZone: 'UTC', webDir: null, auth, now: () => NOW });
}

const cookieOf = (session: Partial<Session> = {}): string =>
  `vocalog_session=${signSession({ userId: 'u1', userName: 'Alex', guildIds: ['g1'], expiresAtSec: Math.floor(NOW / 1000) + 3600, ...session }, SECRET)}`;

const setCookies = (headers: Record<string, unknown>): string[] => {
  const value = headers['set-cookie'];
  return Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
};

describe('GET /auth/login', () => {
  it('redirects to Discord with the right parameters and sets a state cookie', async () => {
    const response = await app(discordAuth(fakeDiscord().fetchFn)).inject('/auth/login');
    expect(response.statusCode).toBe(302);
    const location = new URL(String(response.headers.location));
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('client_id')).toBe('client-1');
    expect(location.searchParams.get('redirect_uri')).toBe('https://example.com/auth/callback');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
    const state = location.searchParams.get('state')!;
    expect(state.length).toBeGreaterThanOrEqual(32);
    const cookie = setCookies(response.headers).find((c) => c.startsWith('vocalog_oauth_state='))!;
    expect(cookie).toContain(state);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('uses a different state each time', async () => {
    const instance = app(discordAuth(fakeDiscord().fetchFn));
    const states = await Promise.all([1, 2, 3].map(async () => new URL(String((await instance.inject('/auth/login')).headers.location)).searchParams.get('state')));
    expect(new Set(states).size).toBe(3);
  });

  it('does not exist without login (local mode)', async () => {
    expect((await app({ mode: 'none' }).inject('/auth/login')).statusCode).toBe(404);
  });
});

describe('GET /auth/callback', () => {
  const callback = (instance: ReturnType<typeof app>, query: string, stateCookie = 'state-123') =>
    instance.inject({ method: 'GET', url: `/auth/callback?${query}`, headers: { cookie: `vocalog_oauth_state=${stateCookie}` } });

  it('logs in, keeps only the servers both sides know, and never stores the Discord token', async () => {
    const discord = fakeDiscord();
    const response = await callback(app(discordAuth(discord.fetchFn)), 'code=abc&state=state-123');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
    const session = setCookies(response.headers).find((c) => c.startsWith('vocalog_session='))!;
    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
    expect(session).toContain('Secure');
    expect(session).not.toContain(ACCESS_TOKEN);
    // The payload is readable: it must hold only the id, the name and the shared servers.
    const payload = JSON.parse(Buffer.from(session.split('=')[1]!.split('.')[0]!, 'base64url').toString('utf8'));
    expect(payload.g).toEqual(['g1']);
    expect(JSON.stringify(payload)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(payload)).not.toContain('g-unknown');
    // The token was used for Discord only, in an Authorization header.
    const bearer = discord.calls.filter((c) => c.headers.authorization);
    expect(bearer).toHaveLength(2);
    expect(bearer.every((c) => c.headers.authorization === `Bearer ${ACCESS_TOKEN}` && c.url.startsWith('https://discord.com/'))).toBe(true);
  });

  it('refuses a callback whose state does not match the cookie, without calling Discord', async () => {
    const discord = fakeDiscord();
    const response = await callback(app(discordAuth(discord.fetchFn)), 'code=abc&state=forged');
    expect(response.headers.location).toBe('/?erreur=etat');
    expect(setCookies(response.headers).some((c) => c.startsWith('vocalog_session='))).toBe(false);
    expect(discord.calls).toHaveLength(0);
  });

  it('refuses a callback with no state cookie, no state or no code', async () => {
    const discord = fakeDiscord();
    const instance = app(discordAuth(discord.fetchFn));
    expect((await instance.inject('/auth/callback?code=abc&state=state-123')).headers.location).toBe('/?erreur=etat');
    expect((await callback(instance, 'code=abc')).headers.location).toBe('/?erreur=etat');
    expect((await callback(instance, 'state=state-123')).headers.location).toBe('/?erreur=etat');
    expect(discord.calls).toHaveLength(0);
  });

  it('reports a refusal on the Discord screen', async () => {
    const response = await callback(app(discordAuth(fakeDiscord().fetchFn)), 'error=access_denied&state=state-123');
    expect(response.headers.location).toBe('/?erreur=refus');
  });

  it('refuses someone who shares no server with Vocalog', async () => {
    const response = await callback(app(discordAuth(fakeDiscord({ guilds: ['g-unknown'] }).fetchFn)), 'code=abc&state=state-123');
    expect(response.headers.location).toBe('/?erreur=aucun-serveur');
    expect(setCookies(response.headers).some((c) => c.startsWith('vocalog_session='))).toBe(false);
  });

  it('fails cleanly when Discord rejects the code', async () => {
    const response = await callback(app(discordAuth(fakeDiscord({ tokenStatus: 400 }).fetchFn)), 'code=abc&state=state-123');
    expect(response.headers.location).toBe('/?erreur=connexion');
    expect(setCookies(response.headers).some((c) => c.startsWith('vocalog_session='))).toBe(false);
  });

  it('clears the state cookie once used', async () => {
    const response = await callback(app(discordAuth(fakeDiscord().fetchFn)), 'code=abc&state=state-123');
    expect(setCookies(response.headers).some((c) => c.startsWith('vocalog_oauth_state=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('does not mark cookies Secure over plain http (local testing)', async () => {
    const response = await callback(app(discordAuth(fakeDiscord().fetchFn, false)), 'code=abc&state=state-123');
    expect(setCookies(response.headers).find((c) => c.startsWith('vocalog_session='))).not.toContain('Secure');
  });
});

describe('POST /auth/logout', () => {
  it('clears the session cookie', async () => {
    const response = await app(discordAuth(fakeDiscord().fetchFn)).inject({ method: 'POST', url: '/auth/logout', headers: { cookie: cookieOf() } });
    expect(response.statusCode).toBe(204);
    expect(setCookies(response.headers).some((c) => c.startsWith('vocalog_session=;') && c.includes('Max-Age=0'))).toBe(true);
  });
});

describe('who is looking: GET /api/me', () => {
  it('says login is needed when nobody is logged in', async () => {
    const response = await app(discordAuth(fakeDiscord().fetchFn)).inject('/api/me');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authMode: 'discord', user: null });
  });

  it('gives the name of the logged-in person and nothing else', async () => {
    const body = (await app(discordAuth(fakeDiscord().fetchFn)).inject({ url: '/api/me', headers: { cookie: cookieOf() } })).json();
    expect(body).toEqual({ authMode: 'discord', user: { id: 'u1', name: 'Alex' } });
  });

  it('treats a forged or expired cookie as nobody', async () => {
    const instance = app(discordAuth(fakeDiscord().fetchFn));
    const forged = (await instance.inject({ url: '/api/me', headers: { cookie: 'vocalog_session=eyJ1IjoidTEifQ.bad' } })).json();
    const expired = (await instance.inject({ url: '/api/me', headers: { cookie: cookieOf({ expiresAtSec: Math.floor(NOW / 1000) - 1 }) } })).json();
    expect(forged.user).toBeNull();
    expect(expired.user).toBeNull();
  });

  it('reports the local mode', async () => {
    expect((await app({ mode: 'none' }).inject('/api/me')).json()).toEqual({ authMode: 'none', user: null });
  });
});

describe('the statistics need a login', () => {
  const instance = () => app(discordAuth(fakeDiscord().fetchFn));
  const guarded = ['/api/guilds', '/api/guilds/g1/summary', '/api/guilds/g1/members/u1', '/api/guilds/nope/summary', '/api/guilds/g1/members/nobody'];

  it('answers 401 to every statistics route without a session', async () => {
    const app1 = instance();
    for (const url of guarded) expect((await app1.inject(url)).statusCode, url).toBe(401);
  });

  it('answers 401 for a tampered or expired session', async () => {
    const app1 = instance();
    expect((await app1.inject({ url: '/api/guilds', headers: { cookie: 'vocalog_session=x.y' } })).statusCode).toBe(401);
    expect((await app1.inject({ url: '/api/guilds', headers: { cookie: cookieOf({ expiresAtSec: Math.floor(NOW / 1000) - 5 }) } })).statusCode).toBe(401);
  });

  it('lists only the servers the person belongs to', async () => {
    const list = (await instance().inject({ url: '/api/guilds', headers: { cookie: cookieOf({ guildIds: ['g1'] }) } })).json();
    expect(list).toEqual([{ id: 'g1', name: 'Test server' }]);
  });

  it('hides a server the person is not in exactly like a missing one', async () => {
    const app1 = instance();
    const headers = { cookie: cookieOf({ guildIds: ['g1'] }) };
    const hidden = await app1.inject({ url: '/api/guilds/g2/summary', headers });
    const missing = await app1.inject({ url: '/api/guilds/does-not-exist/summary', headers });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.body).toBe(missing.body);
    expect((await app1.inject({ url: '/api/guilds/g2/members/u1', headers })).statusCode).toBe(404);
  });

  it('serves a server the person belongs to', async () => {
    const response = await instance().inject({ url: '/api/guilds/g1/summary', headers: { cookie: cookieOf() } });
    expect(response.statusCode).toBe(200);
    expect(response.json().guild.id).toBe('g1');
  });
});

describe('member pages for any member of the server', () => {
  const mutedApp = () => app(discordAuth(fakeDiscord().fetchFn));

  it('gives another person the same page, with microphone time and group muted share', async () => {
    const body = (await mutedApp().inject({ url: '/api/guilds/g1/members/u2', headers: { cookie: cookieOf({ userId: 'u1' }) } })).json();
    expect(body.voiceStates.mutedMs).toBe(30 * 60_000);
    expect(body.group.mutedShare).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('restricted');
  });
});

describe('response headers', () => {
  it('forbids caching of answers about people and adds basic protections', async () => {
    const response = await app(discordAuth(fakeDiscord().fetchFn)).inject({ url: '/api/guilds', headers: { cookie: cookieOf() } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('same-origin');
  });

  it('forbids caching of the login routes too', async () => {
    expect((await app(discordAuth(fakeDiscord().fetchFn)).inject('/auth/login')).headers['cache-control']).toBe('no-store');
  });
});
