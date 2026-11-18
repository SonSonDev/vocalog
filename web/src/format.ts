const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export const WEEKDAYS_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const WEEKDAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** "7 h 05", "45 min", "0 min". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE_MS);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/** Whole hours only: "212 h". */
export function formatHours(ms: number): string {
  return `${Math.round(ms / HOUR_MS)} h`;
}

/** "sam. 8 nov., 21:00" in the given time zone. */
export function formatDateTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms);
}

/** The busiest weekday and hour of a 7 x 24 heat map, or null when it is empty. */
export function busiestCell(heat: number[][]): { weekday: number; hour: number } | null {
  let best: { weekday: number; hour: number } | null = null;
  let bestValue = 0;
  for (let weekday = 0; weekday < heat.length; weekday++) {
    const row = heat[weekday]!;
    for (let hour = 0; hour < row.length; hour++) {
      const value = row[hour]!;
      if (value > bestValue) {
        bestValue = value;
        best = { weekday, hour };
      }
    }
  }
  return best;
}

/** The hour (0 to 23) with the most time, or null when the profile is empty. */
export function busiestHour(hourMs: number[]): number | null {
  let bestHour: number | null = null;
  let bestValue = 0;
  hourMs.forEach((value, hour) => {
    if (value > bestValue) {
      bestValue = value;
      bestHour = hour;
    }
  });
  return bestHour;
}

export function maxOf(values: number[]): number {
  return values.reduce((max, value) => (value > max ? value : max), 0);
}

/** Width of a bar in percent, relative to the largest value, never below 2 for a non-zero value. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}

export function formatClock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(ms);
}

/** "20 h 35" from a minute of the day (0 to 1439). */
export function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/** "42 %" from a ratio (0.42). */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** "+18 %" or "-7 %" (true minus sign) from a percentage already in percent. */
export function formatSignedPercent(percent: number): string {
  if (percent > 0) return `+${percent} %`;
  if (percent < 0) return `−${Math.abs(percent)} %`;
  return '0 %';
}

/** "1er", "2e", "3e". */
export function formatRank(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}

/** Share of a total, 0 to 1; 0 when the total is zero. */
export function shareOf(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/** "16 nov." from a local `YYYY-MM-DD` key. */
export function formatDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(Date.UTC(year!, month! - 1, day!));
}

/**
 * Compares a member's average time of day with the group's, on a day that starts at 06:00 so late nights
 * compare sensibly. Returns a short French phrase.
 */
export function describeTimeDifference(ownMinute: number, groupMinute: number): string {
  const shift = (minute: number): number => (minute - 360 + 1440) % 1440;
  const diff = shift(ownMinute) - shift(groupMinute);
  const abs = Math.abs(diff);
  if (abs < 5) return 'comme le groupe';
  const text = abs >= 60 ? `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, '0')}` : `${abs} min`;
  return `${text} ${diff > 0 ? 'plus tard' : 'plus tôt'} que le groupe`;
}

/** The @handle to show next to a name, or null when it adds nothing (missing, or the same as the name). */
export function visibleHandle(name: string, handle: string | undefined): string | null {
  if (!handle) return null;
  return handle.trim().toLowerCase() === name.trim().toLowerCase() ? null : `@${handle}`;
}
