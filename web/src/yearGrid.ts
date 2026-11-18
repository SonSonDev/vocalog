import type { YearView } from '@vocalog/shared';

export interface GridCell {
  dayKey: string;
  totalMs: number;
  future: boolean;
  /** Column (the week, 0 = the week of 1 January) and row (0 = Monday). */
  column: number;
  row: number;
}

export interface YearGrid {
  cells: GridCell[];
  /** The column where each month starts, for the labels above the grid. */
  months: { monthKey: string; column: number }[];
  columns: number;
}

/**
 * Lays a year out like a contribution graph: weeks as columns (Monday first), weekdays as rows. The first column starts
 * with empty cells until 1 January's weekday, so every day falls at `(ordinal + weekday of 1 January) / 7`, no date maths.
 */
export function buildYearGrid(months: YearView['months']): YearGrid {
  const offset = months[0]?.firstWeekday ?? 0;
  const cells: GridCell[] = [];
  const labels: YearGrid['months'] = [];
  let ordinal = 0;
  for (const month of months) {
    labels.push({ monthKey: month.monthKey, column: Math.floor((ordinal + offset) / 7) });
    for (const day of month.days) {
      cells.push({ dayKey: day.dayKey, totalMs: day.totalMs, future: day.future, column: Math.floor((ordinal + offset) / 7), row: (ordinal + offset) % 7 });
      ordinal++;
    }
  }
  const last = cells[cells.length - 1];
  return { cells, months: labels, columns: last ? last.column + 1 : 0 };
}
