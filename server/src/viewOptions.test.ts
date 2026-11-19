import { describe, expect, it } from 'vitest';
import { resolveTimeZone, resolveWeekStart } from './viewOptions.ts';

describe('resolveTimeZone', () => {
  it('gives the server zone when none is asked for', () => {
    expect(resolveTimeZone(undefined, 'Europe/Paris')).toBe('Europe/Paris');
    expect(resolveTimeZone('', 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('accepts real IANA zones', () => {
    for (const zone of ['Asia/Tokyo', 'America/Argentina/Buenos_Aires', 'UTC', 'America/Port-au-Prince', 'Etc/GMT+5']) expect(resolveTimeZone(zone, 'Europe/Paris')).toBe(zone);
  });

  it('refuses a zone that does not exist and anything that is not shaped like one', () => {
    for (const bad of ['Mars/Olympus', 'Europe/Paris/../x', '../etc/passwd', 'Europe/Paris;drop', 'a'.repeat(80), '<script>', ' ', 'Europe//Paris', '/Europe/Paris', 42, ['Asia/Tokyo'], {}]) {
      expect(resolveTimeZone(bad, 'Europe/Paris'), String(bad)).toBeNull();
    }
  });
});

describe('resolveWeekStart', () => {
  it('is Monday by default and accepts Sunday', () => {
    expect(resolveWeekStart(undefined)).toBe('monday');
    expect(resolveWeekStart('')).toBe('monday');
    expect(resolveWeekStart('monday')).toBe('monday');
    expect(resolveWeekStart('sunday')).toBe('sunday');
  });

  it('refuses anything else', () => {
    for (const bad of ['friday', 'Sunday', 'sun', '1', 7, null, ['sunday'], {}]) expect(resolveWeekStart(bad), String(bad)).toBeNull();
  });
});
