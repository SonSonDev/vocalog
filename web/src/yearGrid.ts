import { dayKeyOf, dayNumber } from '@vocalog/shared';
import type { MemberYear, YearView } from '@vocalog/shared';

export interface GridCell {
  dayKey: string;
  totalMs: number;
  future: boolean;
  /** Column (the week, 0 = the first one shown) and row (0 = Monday). */
  column: number;
  row: number;
}

export interface YearGrid {
  cells: GridCell[];
  /** The column where each month starts, for the labels above the grid. */
  months: { monthKey: string; column: number }[];
  columns: number;
}

/** A label needs about three columns of room (a month name is wider than one cell). */
const MIN_LABEL_GAP = 3;

/**
 * Lays days out like a contribution graph: weeks as columns (Monday first), weekdays as rows. `firstWeekday` is the weekday
 * (0 = Monday) of the first day, so the first column starts with that many empty cells; every day then falls at
 * `(index + firstWeekday) / 7`, with no date maths. A month gets a label at the column where it first appears, unless the
 * next month starts too soon after it (a month cut by the start of the window).
 */
export function buildDayGrid(days: { dayKey: string; totalMs: number; future: boolean }[], firstWeekday: number): YearGrid {
  const cells: GridCell[] = days.map((day, index) => ({
    dayKey: day.dayKey,
    totalMs: day.totalMs,
    future: day.future,
    column: Math.floor((index + firstWeekday) / 7),
    row: (index + firstWeekday) % 7,
  }));

  const starts: YearGrid['months'] = [];
  for (const cell of cells) {
    const monthKey = cell.dayKey.slice(0, 7);
    if (starts[starts.length - 1]?.monthKey !== monthKey) starts.push({ monthKey, column: cell.column });
  }
  const months = starts.filter((start, index) => {
    const next = starts[index + 1];
    return next === undefined || next.column - start.column >= MIN_LABEL_GAP;
  });

  const last = cells[cells.length - 1];
  return { cells, months, columns: last ? last.column + 1 : 0 };
}

/** A calendar year, as the grid of its days. */
export function buildYearGrid(months: YearView['months']): YearGrid {
  return buildDayGrid(
    months.flatMap((month) => month.days),
    months[0]?.firstWeekday ?? 0,
  );
}

/** A member's last 53 weeks, as the grid of their days (the year starts on a Monday). */
export function buildMemberGrid(year: MemberYear): YearGrid {
  const first = dayNumber(year.startKey);
  return buildDayGrid(
    year.totals.map((totalMs, index) => ({ dayKey: dayKeyOf(first + index), totalMs, future: index >= year.elapsedDays })),
    0,
  );
}
