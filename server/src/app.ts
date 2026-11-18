import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { MeResponse, Period } from '@vocalog/shared';
import { createAuth } from './auth.ts';
import type { AuthOptions } from './auth.ts';
import { isPeriod } from './period.ts';
import { buildMemberProfile } from './profile.ts';
import { findGuild, listGuilds, userHasEvents } from './queries.ts';
import type { Db } from './queries.ts';
import { resolveStatic } from './static.ts';
import { buildSummary } from './summary.ts';

export interface AppOptions {
  db: Db;
  timeZone: string;
  /** Folder of the built web app, or null to serve the API only. */
  webDir: string | null;
  /** How people log in. `{ mode: 'none' }` is for local development only. */
  auth: AuthOptions;
  now?: () => number;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, timeZone, webDir } = options;
  const now = options.now ?? (() => Date.now());
  const auth = createAuth(options.auth, now);
  const app = Fastify({ logger: false });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'same-origin');
    // Answers about people must never be cached by a browser or a proxy.
    if (request.url.startsWith('/api/') || request.url.startsWith('/auth/')) reply.header('cache-control', 'no-store');
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
    return { authMode: auth.mode, user: viewer ? { id: viewer.userId, name: viewer.userName } : null };
  });

  app.get('/api/guilds', async (request) => listGuilds(db).filter((guild) => auth.canSeeGuild(request, guild.id)));

  app.get<{ Params: { guildId: string }; Querystring: { period?: string } }>('/api/guilds/:guildId/summary', async (request, reply) => {
    const period = request.query.period ?? '30d';
    if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
    // A server the person cannot see answers exactly like one that does not exist.
    const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    return buildSummary(db, guild, period as Period, now(), timeZone);
  });

  app.get<{ Params: { guildId: string; userId: string }; Querystring: { period?: string } }>(
    '/api/guilds/:guildId/members/:userId',
    async (request, reply) => {
      const period = request.query.period ?? '30d';
      if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
      const guild = auth.canSeeGuild(request, request.params.guildId) ? findGuild(db, request.params.guildId) : null;
      if (!guild) return reply.code(404).send({ error: 'unknown server' });
      if (!userHasEvents(db, guild.id, request.params.userId)) return reply.code(404).send({ error: 'unknown member' });
      return buildMemberProfile(db, guild, request.params.userId, period as Period, now(), timeZone);
    },
  );

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/auth/') || webDir === null) return reply.code(404).send({ error: 'not found' });
    const file = resolveStatic(webDir, request.url);
    if (!file) return reply.code(404).send({ error: 'not found' });
    return reply.header('cache-control', file.cacheControl).type(file.contentType).send(file.body);
  });

  return app;
}
