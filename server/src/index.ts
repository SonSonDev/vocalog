import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { buildApp } from './app.ts';
import type { AuthOptions } from './auth.ts';
import { readServerConfig } from './config.ts';
import type { ServerConfig } from './config.ts';
import { listGuilds } from './queries.ts';

let config: ServerConfig;
try {
  config = readServerConfig(process.env);
} catch (error) {
  // Exit non-zero with a message that names the variable; systemd will report the failure.
  console.error((error as Error).message);
  process.exit(1);
}

if (!existsSync(config.dbPath)) {
  console.error('DB_PATH does not point to an existing database file (start the bot first)');
  process.exit(1);
}

// The server never writes: it opens the bot's database read-only.
const db = new Database(config.dbPath, { readonly: true, fileMustExist: true });

const auth: AuthOptions =
  config.auth.mode === 'none'
    ? { mode: 'none' }
    : {
        mode: 'discord',
        oauth: {
          clientId: config.auth.clientId,
          clientSecret: config.auth.clientSecret,
          redirectUri: `${config.auth.publicUrl}/auth/callback`,
        },
        sessionSecret: config.auth.sessionSecret,
        secureCookies: config.auth.secureCookies,
        fetch: globalThis.fetch,
        knownGuildIds: () => listGuilds(db).map((guild) => guild.id),
      };

const app = buildApp({ db, timeZone: config.timeZone, webDir: config.webDir && existsSync(config.webDir) ? config.webDir : null, auth });

if (config.auth.mode === 'none') console.warn('WARNING: running without login (INSECURE_NO_AUTH=1). Local use only.');

function shutdown(): void {
  void app.close().finally(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: '127.0.0.1', port: config.port });
console.log(`Server listening on 127.0.0.1:${config.port} (${config.auth.mode === 'none' ? 'no login' : 'Discord login'})`);
