import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Period } from '@vocalog/shared';
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
  now?: () => number;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, timeZone, webDir } = options;
  const now = options.now ?? (() => Date.now());
  const app = Fastify({ logger: false });

  app.get('/api/guilds', async () => listGuilds(db));

  app.get<{ Params: { guildId: string }; Querystring: { period?: string } }>('/api/guilds/:guildId/summary', async (request, reply) => {
    const period = request.query.period ?? '30d';
    if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
    const guild = findGuild(db, request.params.guildId);
    if (!guild) return reply.code(404).send({ error: 'unknown server' });
    return buildSummary(db, guild, period as Period, now(), timeZone);
  });

  app.get<{ Params: { guildId: string; userId: string }; Querystring: { period?: string } }>(
    '/api/guilds/:guildId/members/:userId',
    async (request, reply) => {
      const period = request.query.period ?? '30d';
      if (!isPeriod(period)) return reply.code(400).send({ error: 'period must be one of 7d, 30d, 1y, all' });
      const guild = findGuild(db, request.params.guildId);
      if (!guild) return reply.code(404).send({ error: 'unknown server' });
      if (!userHasEvents(db, guild.id, request.params.userId)) return reply.code(404).send({ error: 'unknown member' });
      return buildMemberProfile(db, guild, request.params.userId, period as Period, now(), timeZone);
    },
  );

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || webDir === null) return reply.code(404).send({ error: 'not found' });
    const file = resolveStatic(webDir, request.url);
    if (!file) return reply.code(404).send({ error: 'not found' });
    return reply.header('cache-control', file.cacheControl).type(file.contentType).send(file.body);
  });

  return app;
}
