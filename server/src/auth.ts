import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authorizeUrl, fetchDiscordIdentity } from './oauth.ts';
import type { OAuthSettings } from './oauth.ts';
import { clearCookie, parseCookies, serializeCookie, signSession, verifySession } from './session.ts';
import type { Session } from './session.ts';

const SESSION_COOKIE = 'vocalog_session';
const STATE_COOKIE = 'vocalog_oauth_state';
const STATE_TTL_SEC = 600;
const DEFAULT_SESSION_TTL_SEC = 7 * 24 * 3600;

export type AuthOptions =
  | { mode: 'none' }
  | {
      mode: 'discord';
      oauth: OAuthSettings;
      sessionSecret: string;
      secureCookies: boolean;
      fetch: typeof fetch;
      /** Ids of the servers Vocalog records: a person only gets the ones they share with it. */
      knownGuildIds: () => string[];
      sessionTtlSec?: number;
    };

export interface Auth {
  mode: 'none' | 'discord';
  /** The logged-in person, or null (always null in mode 'none'). */
  viewer(request: FastifyRequest): Session | null;
  /** Whether this request may look at this server. In mode 'none' everything is visible. */
  canSeeGuild(request: FastifyRequest, guildId: string): boolean;
  /** Adds the login routes (nothing in mode 'none'). */
  register(app: FastifyInstance): void;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAuth(options: AuthOptions, now: () => number): Auth {
  if (options.mode === 'none') {
    return { mode: 'none', viewer: () => null, canSeeGuild: () => true, register: () => {} };
  }

  const { oauth, sessionSecret, secureCookies } = options;
  const ttl = options.sessionTtlSec ?? DEFAULT_SESSION_TTL_SEC;

  const viewer = (request: FastifyRequest): Session | null =>
    verifySession(parseCookies(request.headers.cookie).get(SESSION_COOKIE), sessionSecret, Math.floor(now() / 1000));

  return {
    mode: 'discord',
    viewer,
    canSeeGuild: (request, guildId) => viewer(request)?.guildIds.includes(guildId) ?? false,
    register(app) {
      app.get('/auth/login', async (_request, reply) => {
        const state = randomBytes(16).toString('hex');
        reply.header('set-cookie', serializeCookie(STATE_COOKIE, state, { maxAgeSec: STATE_TTL_SEC, secure: secureCookies }));
        return reply.redirect(authorizeUrl(oauth, state));
      });

      app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/auth/callback', async (request, reply) => {
        const expected = parseCookies(request.headers.cookie).get(STATE_COOKIE);
        const clearState = clearCookie(STATE_COOKIE, secureCookies);
        const fail = (reason: string) => reply.header('set-cookie', clearState).redirect(`/?erreur=${reason}`);

        if (request.query.error) return fail('refus');
        const { code, state } = request.query;
        // The state cookie proves this browser started the login: it blocks a forged callback.
        if (!code || !state || !expected || !safeEqual(state, expected)) return fail('etat');

        try {
          const identity = await fetchDiscordIdentity(oauth, code, options.fetch);
          const known = new Set(options.knownGuildIds());
          const guildIds = identity.guildIds.filter((id) => known.has(id));
          if (guildIds.length === 0) return fail('aucun-serveur');

          const session: Session = {
            userId: identity.user.id,
            userName: identity.user.name,
            userHandle: identity.user.handle,
            guildIds,
            expiresAtSec: Math.floor(now() / 1000) + ttl,
          };
          return reply
            .header('set-cookie', [clearState, serializeCookie(SESSION_COOKIE, signSession(session, sessionSecret), { maxAgeSec: ttl, secure: secureCookies })])
            .redirect('/');
        } catch (error) {
          console.error('Login failed:', (error as Error).message);
          return fail('connexion');
        }
      });

      app.post('/auth/logout', async (_request, reply) => reply.header('set-cookie', clearCookie(SESSION_COOKIE, secureCookies)).code(204).send());
    },
  };
}
