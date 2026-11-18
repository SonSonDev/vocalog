import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { isDayKey, isMondayKey, isMonthKey, isYearKey } from '@vocalog/shared';
import type { MeResponse, Period } from '@vocalog/shared';
import { createImageProxy } from './image.ts';
import { createCache } from './cache.ts';
import { buildDayView } from './day.ts';
import { buildMonthView } from './month.ts';
import { createAuth } from './auth.ts';
import type { AuthOptions } from './auth.ts';
import { isPeriod } from './period.ts';
import { buildMemberProfile } from './profile.ts';
import { findGuild, listGuilds, userAvatars, userHasEvents } from './queries.ts';
import type { Db } from './queries.ts';
import { resolveStatic } from './static.ts';
import { buildSummary } from './summary.ts';
import { buildWeekView } from './week.ts';
import { buildYearView } from './year.ts';

export interface AppOptions {
  db: Db;
  timeZone: string;
  /** Folder of the built web app, or null to serve the API only. */
  webDir: string | null;
  /** How people log in. `{ mode: 'none' }` is for local development only. */
  auth: AuthOptions;
  now?: () => number;
  /** Used to fetch avatars from Discord. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, timeZone, webDir } = options;
  const now = options.now ?? (() => Date.now());
  const auth = createAuth(options.auth, now);
  const app = Fastify({ logger: false });
  const cached = createCache(db, now);
  const getImage = createImageProxy(options.fetch ?? globalThis.fetch, now);

  // Nothing is logged by Fastify here, so a failure would leave no trace. Log the route only (the query of a login
  // callback carries a one-time code) and never send internals to the browser.
  app.setErrorHandler((error: { statusCode?: number; message: string }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      console.error(`Request failed: ${request.method} ${request.url.split('?')[0]}:`, error.message);
      return reply.code(500).send({ error: 'internal error' });
    }
    return reply.code(status).send({ error: error.message });
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'same-origin');
    // Answers about people must never be cached by a browser or a proxy (an avatar route sets its own, private, rule).
    if (!reply.hasHeader('cache-control') && (request.url.startsWith('/api/') || request.url.startsWith('/auth/'))) reply.header('cache-control', 'no-store');
  });

  // Every statistic needs a login. The only open API route is /api/me, which says whether one is needed.
  app.addHook('onRequest', async (request, reply) => {
    if (auth.mode === 'discord' && request.url.startsWith('/api/guilds') && auth.viewer(request) === null) {
      return reply.code(401).send({ error: 'login required' });
    }
  });

  auth.register(app);

  app.get('/api/me', async (request): Promise<MeResponse> => {
    const viewer = auth.viewer(request);
    if (!viewer) return { authMode: auth.mode, user: null };
    // The person's own @username comes from the login; the picture hash from what the bot has seen of them (may be absent).
    return { authMode: auth.mode, user: { id: viewer.userId, name: viewer.userName, handle: viewer.userHandle, avatar: userAvatars(db).get(viewer.userId) } };
  });

  app.get('/api/guilds', async (request) => listGuilds(db).filter((guild) => auth.canSeeGuild(request, guild.id)));

  app.get<{ Params: { guildId: string }; Querystring: { period?: string } }>('/api/guilds/:guildId/summary', async (request, reply) => {
    const period = request.query.period ?? '30d';
    if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
    // A server the person cannot see answers exactly like one that does not exist.
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    return cached(`summary|${guild.id}|${period}`, () => buildSummary(db, guild, period as Period, now(), timeZone));
  });

  app.get<{ Params: { guildId: string; userId: string }; Querystring: { period?: string } }>(
    '/api/guilds/:guildId/members/:userId',
    async (request, reply) => {
      const period = request.query.period ?? '30d';
      if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
      const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
      if (!guild) return reply.code(404).send({ error: 'unknown server' });
      if (!userHasEvents(db, guild.id, request.params.userId)) return reply.code(404).send({ error: 'unknown member' });
      return cached(`member|${guild.id}|${request.params.userId}|${period}`, () =>
        buildMemberProfile(db, guild, request.params.userId, period as Period, now(), timeZone),
      );
    },
  );

  app.get<{ Params: { guildId: string; dayKey: string } }>('/api/guilds/:guildId/days/:dayKey', async (request, reply) => {
    if (!isDayKey(request.params.dayKey)) return reply.code(400).send({ error: 'day must be a date written YYYY-MM-DD' });
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    const view = cached(`day|${guild.id}|${request.params.dayKey}`, () => buildDayView(db, guild, request.params.dayKey, now(), timeZone));
    return view ?? reply.code(404).send({ error: 'unknown day' });
  });

  app.get<{ Params: { guildId: string; mondayKey: string } }>('/api/guilds/:guildId/weeks/:mondayKey', async (request, reply) => {
    if (!isMondayKey(request.params.mondayKey)) return reply.code(400).send({ error: 'week must be the date of its Monday, written YYYY-MM-DD' });
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    const view = cached(`week|${guild.id}|${request.params.mondayKey}`, () => buildWeekView(db, guild, request.params.mondayKey, now(), timeZone));
    return view ?? reply.code(404).send({ error: 'unknown week' });
  });

  app.get<{ Params: { guildId: string; monthKey: string } }>('/api/guilds/:guildId/months/:monthKey', async (request, reply) => {
    if (!isMonthKey(request.params.monthKey)) return reply.code(400).send({ error: 'month must be written YYYY-MM' });
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    const view = cached(`month|${guild.id}|${request.params.monthKey}`, () => buildMonthView(db, guild, request.params.monthKey, now(), timeZone));
    return view ?? reply.code(404).send({ error: 'unknown month' });
  });

  app.get<{ Params: { guildId: string; yearKey: string } }>('/api/guilds/:guildId/years/:yearKey', async (request, reply) => {
    if (!isYearKey(request.params.yearKey)) return reply.code(400).send({ error: 'year must be written YYYY' });
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    const view = cached(`year|${guild.id}|${request.params.yearKey}`, () => buildYearView(db, guild, request.params.yearKey, now(), timeZone));
    return view ?? reply.code(404).send({ error: 'unknown year' });
  });

  // The picture of a member, fetched from Discord by this server. The hash comes from the database, not from the request,
  // and the answer is the same for everybody who may see the server, so the browser may keep it: the page asks with `?v=<hash>`.
  app.get<{ Params: { guildId: string; userId: string } }>('/api/guilds/:guildId/avatars/:userId', async (request, reply) => {
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild || !userHasEvents(db, guild.id, request.params.userId)) return reply.code(404).send({ error: 'unknown member' });
    const hash = userAvatars(db).get(request.params.userId);
    const image = hash ? await getImage('avatars', request.params.userId, hash) : null;
    if (!image) return reply.code(404).send({ error: 'no avatar' });
    return reply.header('cache-control', 'private, max-age=86400').type(image.contentType).send(image.body);
  });

  // The server's icon, fetched from Discord by this server. Same rules as an avatar: the hash comes from the database.
  app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/icon', async (request, reply) => {
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    const image = guild?.icon ? await getImage('icons', guild.id, guild.icon) : null;
    if (!image) return reply.code(404).send({ error: 'no icon' });
    return reply.header('cache-control', 'private, max-age=86400').type(image.contentType).send(image.body);
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/auth/') || webDir === null) return reply.code(404).send({ error: 'not found' });
    const file = resolveStatic(webDir, request.url);
    if (!file) return reply.code(404).send({ error: 'not found' });
    return reply.header('cache-control', file.cacheControl).type(file.contentType).send(file.body);
  });

  return app;
}
