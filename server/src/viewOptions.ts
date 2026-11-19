import type { WeekStart } from '@vocalog/shared';

/**
 * The time zone a request asks for with `?tz=Europe/Paris`, or the server's own when it asks for none. Null when the name is
 * not a real IANA zone: it must be refused, never passed on. Only the shape of an IANA name is accepted before it is tried.
 */
export function resolveTimeZone(value: unknown, fallback: string): string | null {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+){0,2}$/.test(value)) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** The day weeks start on, asked for with `?ws=sunday`: Monday when none is asked for, null for anything else (to refuse). */
export function resolveWeekStart(value: unknown): WeekStart | null {
  if (value === undefined || value === '') return 'monday';
  return value === 'monday' || value === 'sunday' ? value : null;
}
