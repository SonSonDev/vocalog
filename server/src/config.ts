import { isAbsolute } from 'node:path';

export type AuthConfig =
  | { mode: 'none' }
  | {
      mode: 'discord';
      clientId: string;
      clientSecret: string;
      sessionSecret: string;
      /** Origin only, for example `https://example.com`. The OAuth redirect is `<publicUrl>/auth/callback`. */
      publicUrl: string;
      secureCookies: boolean;
    };

export interface ServerConfig {
  /** Absolute path of the SQLite file written by the bot. Opened read-only. */
  dbPath: string;
  port: number;
  /** IANA time zone used for hours, weekdays and days in the statistics. */
  timeZone: string;
  /** Folder of the built web app, served when it exists. */
  webDir: string | null;
  auth: AuthConfig;
}

const DISCORD_VARIABLES = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'SESSION_SECRET', 'PUBLIC_URL'] as const;
const MIN_SECRET_LENGTH = 32;

function readAuth(env: Record<string, string | undefined>): AuthConfig {
  const insecure = env.INSECURE_NO_AUTH === '1';
  const present = DISCORD_VARIABLES.filter((name) => (env[name]?.trim() ?? '') !== '');

  if (insecure) {
    // Never allow the no-login mode next to real login settings: a forgotten flag would silently open the dashboard.
    if (present.length > 0) throw new Error('INSECURE_NO_AUTH=1 cannot be combined with the Discord login variables: remove one of them');
    return { mode: 'none' };
  }

  for (const name of DISCORD_VARIABLES) {
    if (!env[name]?.trim()) {
      throw new Error(`${name} is required (or set INSECURE_NO_AUTH=1 to run locally without login, never on a public host)`);
    }
  }
  const sessionSecret = env.SESSION_SECRET!.trim();
  if (sessionSecret.length < MIN_SECRET_LENGTH) throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);

  let url: URL;
  try {
    url = new URL(env.PUBLIC_URL!.trim());
  } catch {
    throw new Error('PUBLIC_URL must be a valid URL such as https://example.com');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('PUBLIC_URL must use https (http is only allowed for localhost)');
  }

  return {
    mode: 'discord',
    clientId: env.DISCORD_CLIENT_ID!.trim(),
    clientSecret: env.DISCORD_CLIENT_SECRET!.trim(),
    sessionSecret,
    publicUrl: url.origin,
    secureCookies: url.protocol === 'https:',
  };
}

/**
 * Reads the configuration from environment variables at start time.
 * Every error names the variable, never its value.
 */
export function readServerConfig(env: Record<string, string | undefined>): ServerConfig {
  const dbPath = env.DB_PATH?.trim();
  if (!dbPath) throw new Error('DB_PATH is required');
  if (!isAbsolute(dbPath)) throw new Error('DB_PATH must be an absolute path');

  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');

  const timeZone = env.STATS_TIME_ZONE?.trim() || 'Europe/Paris';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
  } catch {
    throw new Error('STATS_TIME_ZONE must be a valid IANA time zone, for example Europe/Paris');
  }

  const webDir = env.WEB_DIR?.trim() || null;
  if (webDir !== null && !isAbsolute(webDir)) throw new Error('WEB_DIR must be an absolute path');

  return { dbPath, port, timeZone, webDir, auth: readAuth(env) };
}
