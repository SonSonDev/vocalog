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

describe('readServerConfig: login settings', () => {
  const discord = {
    DB_PATH: '/var/lib/vocalog/db.sqlite',
    DISCORD_CLIENT_ID: '123',
    DISCORD_CLIENT_SECRET: 'client-secret-value',
    SESSION_SECRET: 'x'.repeat(32),
    PUBLIC_URL: 'https://example.com',
  };

  it('reads a complete Discord login configuration', () => {
    expect(readServerConfig(discord).auth).toEqual({
      mode: 'discord',
      clientId: '123',
      clientSecret: 'client-secret-value',
      sessionSecret: 'x'.repeat(32),
      publicUrl: 'https://example.com',
      secureCookies: true,
    });
  });

  it('keeps only the origin of PUBLIC_URL', () => {
    expect((readServerConfig({ ...discord, PUBLIC_URL: 'https://example.com/some/path/' }).auth as { publicUrl: string }).publicUrl).toBe('https://example.com');
  });

  it('allows plain http only for localhost, without Secure cookies', () => {
    const local = readServerConfig({ ...discord, PUBLIC_URL: 'http://localhost:3111' }).auth as { publicUrl: string; secureCookies: boolean };
    expect(local.publicUrl).toBe('http://localhost:3111');
    expect(local.secureCookies).toBe(false);
    expect(() => readServerConfig({ ...discord, PUBLIC_URL: 'http://example.com' })).toThrow(/https/);
  });

  it('names each missing login variable', () => {
    for (const name of ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'SESSION_SECRET', 'PUBLIC_URL']) {
      expect(() => readServerConfig({ ...discord, [name]: undefined }), name).toThrow(new RegExp(name));
      expect(() => readServerConfig({ ...discord, [name]: '  ' }), name).toThrow(new RegExp(name));
    }
  });

  it('refuses a short session secret and a malformed public URL', () => {
    expect(() => readServerConfig({ ...discord, SESSION_SECRET: 'too-short' })).toThrow(/SESSION_SECRET/);
    expect(() => readServerConfig({ ...discord, PUBLIC_URL: 'not a url' })).toThrow(/PUBLIC_URL/);
  });

  it('refuses the no-login mode next to login variables, so a forgotten flag cannot open the dashboard', () => {
    expect(() => readServerConfig({ ...discord, INSECURE_NO_AUTH: '1' })).toThrow(/cannot be combined/);
    expect(() => readServerConfig({ DB_PATH: discord.DB_PATH, INSECURE_NO_AUTH: '1', SESSION_SECRET: 'x'.repeat(32) })).toThrow(/cannot be combined/);
  });

  it('starts without login only when INSECURE_NO_AUTH is exactly 1', () => {
    expect(readServerConfig({ DB_PATH: discord.DB_PATH, INSECURE_NO_AUTH: '1' }).auth).toEqual({ mode: 'none' });
    for (const value of ['0', 'true', 'yes', '', undefined]) {
      expect(() => readServerConfig({ DB_PATH: discord.DB_PATH, INSECURE_NO_AUTH: value }), String(value)).toThrow();
    }
  });

  it('never puts a secret in an error message', () => {
    for (const env of [{ ...discord, SESSION_SECRET: 'short-secret-value' }, { ...discord, PUBLIC_URL: 'http://client-secret-value.example' }]) {
      try {
        readServerConfig(env);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('short-secret-value');
        expect(message).not.toContain('client-secret-value');
      }
    }
  });
});
