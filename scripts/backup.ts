/**
 * Consistent copy of the live database (SQLite `VACUUM INTO`, safe while the bot writes), then removal of the oldest copies.
 *
 * Usage: node scripts/backup.ts <absolute path of the database> <absolute folder for the copies> [copies to keep, default 14]
 * It only reads the database and only deletes files it named itself (`vocalog-<time>.sqlite` in the given folder).
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const NAME = /^vocalog-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/;

export function backup(dbPath: string, folder: string, keep: number, now: Date = new Date()): { file: string; removed: string[] } {
  if (!isAbsolute(dbPath) || !isAbsolute(folder)) throw new Error('Both paths must be absolute');
  if (!existsSync(dbPath)) throw new Error('The database file does not exist');
  if (!Number.isInteger(keep) || keep < 1) throw new Error('The number of copies to keep must be a whole number of at least 1');

  mkdirSync(folder, { recursive: true });
  const file = join(folder, `vocalog-${now.toISOString().replace(/[:.]/g, '-')}.sqlite`);
  if (existsSync(file)) throw new Error('A copy with this name already exists');

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    db.prepare('VACUUM INTO ?').run(file);
  } finally {
    db.close();
  }

  // Names sort by time. Never delete the copy just made, whatever the clock says.
  const old = readdirSync(folder).filter((name) => NAME.test(name) && join(folder, name) !== file).sort();
  const removed = old.slice(0, Math.max(0, old.length - (keep - 1)));
  for (const name of removed) rmSync(join(folder, name));
  return { file, removed };
}

if (import.meta.filename === process.argv[1]) {
  const [dbPath, folder, keepText] = process.argv.slice(2);
  try {
    if (!dbPath || !folder) throw new Error('Usage: node scripts/backup.ts <absolute database path> <absolute backup folder> [copies to keep]');
    const result = backup(dbPath, folder, keepText === undefined ? 14 : Number(keepText));
    console.log(`Backup written: ${result.file}; removed ${result.removed.length} old copie(s).`);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
