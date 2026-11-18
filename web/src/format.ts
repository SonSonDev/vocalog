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

/** "mardi 17 novembre" from a local `YYYY-MM-DD` key. */
export function formatDayLong(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(Date.UTC(year!, month! - 1, day!));
}

/** "mar. 17 nov." from a local `YYYY-MM-DD` key. */
export function formatDayShort(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(Date.UTC(year!, month! - 1, day!));
}

/** "20:30" for a bin of a timeline day that starts at 06:00. Plain arithmetic: it ignores a daylight saving change inside the day. */
export function binClock(index: number, binMinutes: number): string {
  const minute = (6 * 60 + index * binMinutes) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** "3 personnes", "1 personne", "personne". */
export function formatPeople(count: number): string {
  if (count <= 0) return 'personne';
  const rounded = Math.round(count * 10) / 10;
  return `${String(rounded).replace('.', ',')} personne${rounded >= 2 ? 's' : ''}`;
}

/** One or two capital letters for a name, used when a person has no picture: "Alex Martin" gives "AM". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!);
  return letters.length > 0 ? letters.join('').toLocaleUpperCase('fr-FR') : '?';
}

/** "21 h" for the whole hour that contains this instant, in the given time zone. */
export function formatHourLabel(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: 'numeric' }).format(ms);
}

/**
 * The part of a timeline day worth showing: from the whole hour before the first arrival to the whole hour after the last
 * departure (at least three hours), and the step between two time marks. Always inside the day.
 */
export function timelineView(day: { startMs: number; endMs: number }, firstMs: number, lastMs: number): { startMs: number; endMs: number; stepMs: number } {
  const HOUR = 3_600_000;
  const startMs = Math.max(day.startMs, day.startMs + Math.floor((firstMs - 30 * 60_000 - day.startMs) / HOUR) * HOUR);
  let endMs = Math.min(day.endMs, day.startMs + Math.ceil((lastMs + 30 * 60_000 - day.startMs) / HOUR) * HOUR);
  if (endMs - startMs < 3 * HOUR) endMs = Math.min(day.endMs, startMs + 3 * HOUR);
  const hours = (endMs - startMs) / HOUR;
  const stepMs = (hours <= 6 ? 1 : hours <= 12 ? 2 : 3) * HOUR;
  return { startMs, endMs, stepMs };
}

/** The 24 hours of an hourly profile, the day starting at 06:00 so an evening that passes midnight stays in one piece. */
export const HOURS_FROM_SIX: readonly number[] = Array.from({ length: 24 }, (_, index) => (index + 6) % 24);

const longDay = (ms: number): string => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(ms);

function mondayMs(mondayKey: string): number {
  const [year, month, day] = mondayKey.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

/** "9 au 15 novembre" or "26 octobre au 1 novembre" from the Monday of a week. */
export function formatWeekRange(mondayKey: string): string {
  const start = mondayMs(mondayKey);
  const end = start + 6 * 86_400_000;
  const sameMonth = new Date(start).getUTCMonth() === new Date(end).getUTCMonth();
  return `${sameMonth ? String(new Date(start).getUTCDate()) : longDay(start)} au ${longDay(end)}`;
}

/** "9 – 15 nov." from the Monday of a week, for a small label. */
export function formatWeekShort(mondayKey: string): string {
  const start = mondayMs(mondayKey);
  const end = start + 6 * 86_400_000;
  const short = (ms: number): string => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(ms);
  const sameMonth = new Date(start).getUTCMonth() === new Date(end).getUTCMonth();
  return `${sameMonth ? String(new Date(start).getUTCDate()) : short(start)} – ${short(end)}`;
}

/** The ISO week number (the week of the year's first Thursday is week 1). */
export function isoWeekNumber(mondayKey: string): number {
  const thursday = mondayMs(mondayKey) + 3 * 86_400_000;
  const januaryFirst = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - januaryFirst) / (7 * 86_400_000)) + 1;
}

/** "novembre 2026" from `YYYY-MM`. */
export function formatMonthLong(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(Date.UTC(year!, month! - 1, 1));
}

/** "nov. 2026" from `YYYY-MM`. */
export function formatMonthShort(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(Date.UTC(year!, month! - 1, 1));
}

/** "10 h", "45 min", or an empty text for nothing: for a small calendar cell. */
export function formatCompactDuration(ms: number): string {
  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes <= 0) return '';
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/** "sam. 14" from a local `YYYY-MM-DD` key: short enough for a key figure on a phone. */
export function formatDayWeekday(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(Date.UTC(year!, month! - 1, day!));
}

/** "novembre" from `YYYY-MM`. */
export function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long' }).format(Date.UTC(year!, month! - 1, 1));
}
