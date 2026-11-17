import { PERIODS } from '@vocalog/shared';
import type { Period } from '@vocalog/shared';

const DAY_MS = 86_400_000;

export function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

/**
 * Window [fromMs, toMs) of a period. It never starts before the first recorded event, so a young journal is not
 * averaged over days that were never recorded (a 30-day period on a 2-day journal covers 2 days).
 * With no event at all, `all` covers the last day.
 */
export function periodWindow(period: Period, nowMs: number, firstEventMs: number | null): { fromMs: number; toMs: number } {
  const lengthDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : null;
  const wanted = nowMs - (lengthDays ?? 1) * DAY_MS;
  if (firstEventMs === null) return { fromMs: wanted, toMs: nowMs };
  return { fromMs: lengthDays === null ? firstEventMs : Math.max(wanted, firstEventMs), toMs: nowMs };
}
