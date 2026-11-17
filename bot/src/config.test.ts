import { describe, expect, it } from 'vitest';
import { readConfig } from './config.ts';

const base = { DISCORD_TOKEN: 'secret-token-value', ALLOWED_GUILD_IDS: '1,2', DB_PATH: '/var/lib/app/db.sqlite' };

describe('readConfig', () => {
  it('reads a complete configuration', () => {
    const config = readConfig(base);
    expect(config.token).toBe('secret-token-value');
    expect([...config.allowedGuildIds]).toEqual(['1', '2']);
    expect(config.dbPath).toBe('/var/lib/app/db.sqlite');
  });

  it('names the missing variable', () => {
    expect(() => readConfig({ ...base, DISCORD_TOKEN: undefined })).toThrow(/DISCORD_TOKEN/);
    expect(() => readConfig({ ...base, ALLOWED_GUILD_IDS: ' ' })).toThrow(/ALLOWED_GUILD_IDS/);
    expect(() => readConfig({ ...base, DB_PATH: undefined })).toThrow(/DB_PATH/);
  });

  it('refuses a relative database path', () => {
    expect(() => readConfig({ ...base, DB_PATH: './data/db.sqlite' })).toThrow(/absolute/);
  });

  it('never puts a value in an error message', () => {
    for (const env of [{ ...base, DB_PATH: 'relative-secret-path' }, { ...base, ALLOWED_GUILD_IDS: '' }]) {
      try {
        readConfig(env);
      } catch (error) {
        expect((error as Error).message).not.toContain('relative-secret-path');
        expect((error as Error).message).not.toContain('secret-token-value');
      }
    }
  });
});
