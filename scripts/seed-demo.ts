/**
 * Creates a demo database with fictional members and about 45 days of voice sessions,
 * so the dashboard can be developed without real data.
 *
 * Usage: node scripts/seed-demo.ts <absolute path of a NEW database file>
 * It refuses to touch an existing file, so it can never overwrite the real database.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

const target = process.argv[2];
if (!target || !isAbsolute(target)) {
  console.error('Usage: node scripts/seed-demo.ts <absolute path of a NEW database file>');
  process.exit(1);
}
if (existsSync(target)) {
  console.error('Refusing to overwrite an existing file. Choose a new path.');
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });

const db = new Database(target);
db.pragma('journal_mode = WAL');
const migrations = join(import.meta.dirname, '..', 'db', 'migrations');
for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
  db.exec(readFileSync(join(migrations, file), 'utf8'));
}

// Deterministic pseudo-random numbers, so the demo is the same every time.
let seed = 42;
const random = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;
const nowMs = Date.now();
const guildId = 'demo-guild';
const channels = [
  ['demo-general', 'Général'],
  ['demo-jeux', 'Jeux'],
  ['demo-chill', 'Chill'],
] as const;
const members = [
  ['demo-u1', 'Camille', 0.85],
  ['demo-u2', 'Noé', 0.8],
  ['demo-u3', 'Inès', 0.6],
  ['demo-u4', 'Hugo', 0.5],
  ['demo-u5', 'Léa', 0.35],
  ['demo-u6', 'Tom', 0.2],
] as const;

db.prepare('INSERT INTO guilds (id, name, updated_ms) VALUES (?, ?, ?)').run(guildId, 'Serveur de démo', nowMs);
for (const [id, name] of channels) db.prepare('INSERT INTO channels (id, guild_id, name, updated_ms) VALUES (?, ?, ?, ?)').run(id, guildId, name, nowMs);
for (const [id, name] of members) db.prepare('INSERT INTO users (id, name, updated_ms) VALUES (?, ?, ?)').run(id, name, nowMs);

const insert = db.prepare(
  `INSERT INTO voice_events (guild_id, user_id, channel_id, kind, flags, at_ms, source, raw_json)
   VALUES (?, ?, ?, ?, 0, ?, 'live', '{"demo":true}')`,
);

db.transaction(() => {
  const startDay = Math.floor((nowMs - 45 * DAY) / DAY) * DAY;
  for (let day = startDay; day < nowMs; day += DAY) {
    const weekday = (new Date(day).getUTCDay() + 6) % 7; // 0 = Monday
    const weekend = weekday >= 4;
    // One shared evening gathering most days, in a channel chosen for the day.
    const channel = channels[Math.floor(random() * channels.length)]![0];
    const gatherStart = day + (weekend ? 19 : 20) * HOUR + Math.floor(random() * 90) * 60_000;
    for (const [userId, , presence] of members) {
      if (random() > presence * (weekend ? 1 : 0.7)) continue;
      const start = gatherStart + Math.floor(random() * 60) * 60_000;
      const length = (1 + random() * (weekend ? 5 : 3)) * HOUR;
      const end = Math.min(start + length, nowMs - 60_000);
      if (end <= start) continue;
      insert.run(guildId, userId, channel, 'join', start);
      if (random() < 0.25) {
        const middle = start + (end - start) / 2;
        insert.run(guildId, userId, 'demo-chill', 'move', Math.floor(middle));
      }
      insert.run(guildId, userId, null, 'leave', Math.floor(end));
    }
    // A short afternoon session at the weekend for two members.
    if (weekend && random() < 0.5) {
      const start = day + 14 * HOUR + Math.floor(random() * 120) * 60_000;
      for (const userId of ['demo-u1', 'demo-u2']) {
        insert.run(guildId, userId, 'demo-jeux', 'join', start);
        insert.run(guildId, userId, null, 'leave', start + (1 + random() * 2) * HOUR);
      }
    }
  }
})();

const count = (db.prepare('SELECT COUNT(*) AS n FROM voice_events').get() as { n: number }).n;
db.close();
console.log(`Demo database created with ${count} events.`);
