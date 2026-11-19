import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, effectiveTheme, isValidTimeZone, parseSettings, timeZoneNames, timeZoneParam, viewQuery } from './settings.ts';

describe('parseSettings', () => {
  it('gives the defaults for nothing, for garbage and for an empty record', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('text')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const stored = { theme: 'dark', accent: 'bleu', density: 'compact', reduceMotion: true, defaultPeriod: '7d', timeZone: 'Asia/Tokyo', weekStart: 'sunday' };
    expect(parseSettings(stored)).toEqual(stored);
  });

  it('replaces each invalid field by its default, and only that field', () => {
    const result = parseSettings({ theme: 'purple', accent: 'bleu', density: 3, reduceMotion: 'yes', defaultPeriod: '3d', timeZone: 'Mars/Olympus', weekStart: 'friday' });
    expect(result).toEqual({ ...DEFAULT_SETTINGS, accent: 'bleu' });
  });

  it('accepts the two special time zones, and refuses an unknown accent', () => {
    expect(parseSettings({ timeZone: 'browser' }).timeZone).toBe('browser');
    expect(parseSettings({ timeZone: 'server' }).timeZone).toBe('server');
    expect(parseSettings({ accent: 'magenta' }).accent).toBe(DEFAULT_SETTINGS.accent);
  });

  it('takes the theme of the previous version when there is no record of the new one', () => {
    expect(parseSettings(null, 'dark').theme).toBe('dark');
    expect(parseSettings(null, 'light').theme).toBe('light');
    expect(parseSettings(null, 'sepia').theme).toBe('system');
    expect(parseSettings({ theme: 'light' }, 'dark').theme).toBe('light'); // the new record wins
  });
});

describe('theme and time zone helpers', () => {
  it('follows the system only in system mode', () => {
    expect(effectiveTheme('system', true)).toBe('dark');
    expect(effectiveTheme('system', false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
    expect(effectiveTheme('dark', false)).toBe('dark');
  });

  it('recognises real time zones only', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('sends nothing for the server zone, the device zone for browser, and the chosen one otherwise', () => {
    expect(timeZoneParam({ ...DEFAULT_SETTINGS, timeZone: 'server' }, 'Europe/Berlin')).toBe('');
    expect(timeZoneParam({ ...DEFAULT_SETTINGS, timeZone: 'browser' }, 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(timeZoneParam({ ...DEFAULT_SETTINGS, timeZone: 'Asia/Tokyo' }, 'Europe/Berlin')).toBe('Asia/Tokyo');
  });
});

describe('what is sent with a request', () => {
  it('sends nothing for the server zone and the zone name otherwise', () => {
    expect(viewQuery(DEFAULT_SETTINGS)).toBe('');
    expect(viewQuery({ ...DEFAULT_SETTINGS, timeZone: 'Asia/Tokyo' })).toBe('tz=Asia%2FTokyo');
    expect(viewQuery({ ...DEFAULT_SETTINGS, timeZone: 'browser' }, 'America/Argentina/Buenos_Aires')).toBe('tz=America%2FArgentina%2FBuenos_Aires');
  });

  it('offers real zones, sorted, each of them accepted', () => {
    const names = timeZoneNames();
    expect(names).toContain('UTC');
    expect(names).toContain('Europe/Paris');
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    for (const name of names) expect(isValidTimeZone(name), name).toBe(true);
  });
});
