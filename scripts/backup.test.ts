import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backup } from './backup.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'vocalog-backup-'));
  dirs.push(dir);
  const dbPath = join(dir, 'live.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE t (n INTEGER); INSERT INTO t VALUES (1), (2), (3);');
  return { dir, dbPath, db, folder: join(dir, 'copies') };
}

describe('backup', () => {
  it('writes a readable copy while the database is open for writing', () => {
    const { dbPath, db, folder } = workspace();
    const { file } = backup(dbPath, folder, 5, new Date('2026-11-18T03:00:00.000Z'));
    db.close();
    const copy = new Database(file, { readonly: true });
    expect((copy.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number }).c).toBe(3);
    copy.close();
  });

  it('keeps only the newest copies and never touches other files', () => {
    const { dbPath, db, folder } = workspace();
    db.close();
    for (let day = 10; day <= 14; day++) backup(dbPath, folder, 3, new Date(`2026-11-${day}T03:00:00.000Z`));
    writeFileSync(join(folder, 'notes.txt'), 'mine');
    const result = backup(dbPath, folder, 3, new Date('2026-11-15T03:00:00.000Z'));
    const left = readdirSync(folder).sort();
    expect(left.filter((name) => name.endsWith('.sqlite'))).toHaveLength(3);
    expect(left).toContain('notes.txt');
    expect(left.some((name) => name.includes('2026-11-15'))).toBe(true);
    expect(result.removed).toHaveLength(1);
  });

  it('refuses a missing database, relative paths and a bad count, and creates nothing', () => {
    const { dir, db, folder } = workspace();
    db.close();
    expect(() => backup(join(dir, 'missing.sqlite'), folder, 3)).toThrow('does not exist');
    expect(() => backup('live.sqlite', folder, 3)).toThrow('absolute');
    expect(() => backup(join(dir, 'live.sqlite'), folder, 0)).toThrow('at least 1');
    expect(existsSync(folder)).toBe(false);
  });
});
