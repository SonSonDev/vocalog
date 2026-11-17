import { isAbsolute } from 'node:path';

export interface ServerConfig {
  /** Absolute path of the SQLite file written by the bot. Opened read-only. */
  dbPath: string;
  port: number;
  /** IANA time zone used for hours, weekdays and days in the statistics. */
  timeZone: string;
  /** Folder of the built web app, served when it exists. */
  webDir: string | null;
  /** True only when INSECURE_NO_AUTH=1 was set explicitly. */
  insecureNoAuth: boolean;
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

  // Until Discord login is built, the API has no authentication: refuse to start unless that is explicit.
  if (env.INSECURE_NO_AUTH !== '1') {
    throw new Error('Authentication is not built yet: set INSECURE_NO_AUTH=1 to run the server locally without it (never on a public host)');
  }

  return { dbPath, port, timeZone, webDir, insecureNoAuth: true };
}
