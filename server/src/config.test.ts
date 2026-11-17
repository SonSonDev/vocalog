import { describe, expect, it } from 'vitest';
import { readServerConfig } from './config.ts';

const base = { DB_PATH: '/var/lib/vocalog/db.sqlite', INSECURE_NO_AUTH: '1' };

describe('readServerConfig', () => {
  it('reads defaults', () => {
    const config = readServerConfig(base);
    expect(config).toMatchObject({ dbPath: '/var/lib/vocalog/db.sqlite', port: 3000, timeZone: 'Europe/Paris', webDir: null });
  });

  it('reads PORT, STATS_TIME_ZONE and WEB_DIR', () => {
    const config = readServerConfig({ ...base, PORT: '8080', STATS_TIME_ZONE: 'UTC', WEB_DIR: '/srv/web' });
    expect(config).toMatchObject({ port: 8080, timeZone: 'UTC', webDir: '/srv/web' });
  });

  it('names the variable on errors', () => {
    expect(() => readServerConfig({ INSECURE_NO_AUTH: '1' })).toThrow(/DB_PATH/);
    expect(() => readServerConfig({ ...base, DB_PATH: 'relative.sqlite' })).toThrow(/DB_PATH/);
    expect(() => readServerConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => readServerConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => readServerConfig({ ...base, STATS_TIME_ZONE: 'Nowhere/City' })).toThrow(/STATS_TIME_ZONE/);
    expect(() => readServerConfig({ ...base, WEB_DIR: 'web' })).toThrow(/WEB_DIR/);
  });

  it('refuses to start without authentication unless explicitly allowed', () => {
    expect(() => readServerConfig({ DB_PATH: '/var/lib/vocalog/db.sqlite' })).toThrow(/INSECURE_NO_AUTH/);
    expect(() => readServerConfig({ ...base, INSECURE_NO_AUTH: 'yes' })).toThrow(/INSECURE_NO_AUTH/);
  });

  it('does not put values in error messages', () => {
    try {
      readServerConfig({ ...base, DB_PATH: 'relative-secret-path.sqlite' });
    } catch (error) {
      expect((error as Error).message).not.toContain('relative-secret-path');
    }
  });
});
