import { isAbsolute } from 'node:path';
import { parseAllowList } from './allowlist.ts';

export interface Config {
  token: string;
  allowedGuildIds: Set<string>;
  /** Absolute path of the SQLite file, outside the application folder. */
  dbPath: string;
}

/**
 * Reads the configuration from environment variables at start time.
 * Every error names the variable, never its value.
 */
export function readConfig(env: Record<string, string | undefined>): Config {
  const token = env.DISCORD_TOKEN?.trim();
  if (!token) throw new Error('DISCORD_TOKEN is required');

  const allowedGuildIds = parseAllowList(env.ALLOWED_GUILD_IDS);

  const dbPath = env.DB_PATH?.trim();
  if (!dbPath) throw new Error('DB_PATH is required');
  if (!isAbsolute(dbPath)) {
    throw new Error('DB_PATH must be an absolute path outside the application folder (updates replace that folder)');
  }

  return { token, allowedGuildIds, dbPath };
}
