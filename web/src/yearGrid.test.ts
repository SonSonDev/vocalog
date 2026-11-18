import type { YearView } from '@vocalog/shared';
import { describe, expect, it } from 'vitest';
import { buildDayGrid, buildMemberGrid, buildYearGrid } from './yearGrid.ts';

/** A year made only of its calendar: no voice time, 1 January on the given weekday (0 = Monday). */
function year(yearKey: number, firstWeekday: number): YearView['months'] {
  const lengths = [31, yearKey % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let weekday = firstWeekday;
  return lengths.map((length, index) => {
    const monthKey = `${yearKey}-${String(index + 1).padStart(2, '0')}`;
    const month = {
      monthKey,
      totalMs: 0,
      activeDays: 0,
      firstWeekday: weekday,
      days: Array.from({ length }, (_, day) => ({ dayKey: `${monthKey}-${String(day + 1).padStart(2, '0')}`, totalMs: 0, future: false })),
    };
    weekday = (weekday + length) % 7;
    return month;
  });
}

describe('buildYearGrid', () => {
  it('puts 1 January on its weekday in the first column and counts the weeks', () => {
    const grid = buildYearGrid(year(2026, 3)); // 1 January 2026 is a Thursday
    expect(grid.cells).toHaveLength(365);
    expect(grid.cells[0]).toMatchObject({ dayKey: '2026-01-01', column: 0, row: 3 });
    expect(grid.cells[3]).toMatchObject({ dayKey: '2026-01-04', column: 0, row: 6 }); // the Sunday closes the first column
    expect(grid.cells[4]).toMatchObject({ dayKey: '2026-01-05', column: 1, row: 0 }); // the next Monday opens the second
    expect(grid.columns).toBe(53);
  });

  it('puts every day on the weekday its month says, whatever the year', () => {
    for (const [yearKey, weekday] of [[2026, 3], [2024, 0], [2023, 6], [2027, 4]] as const) {
      const months = year(yearKey, weekday);
      const grid = buildYearGrid(months);
      const byDay = new Map(grid.cells.map((cell) => [cell.dayKey, cell]));
      for (const month of months) {
        month.days.forEach((day, index) => expect(byDay.get(day.dayKey)!.row).toBe((month.firstWeekday + index) % 7));
      }
      expect(grid.cells).toHaveLength(yearKey % 4 === 0 ? 366 : 365);
    }
  });

  it('never puts two days in one place, and a column holds at most seven days', () => {
    const grid = buildYearGrid(year(2026, 3));
    expect(new Set(grid.cells.map((cell) => `${cell.column}:${cell.row}`)).size).toBe(grid.cells.length);
    expect(Math.max(...grid.cells.map((cell) => cell.row))).toBe(6);
  });

  it('gives each month the column of its first day, in increasing order', () => {
    const grid = buildYearGrid(year(2026, 3));
    expect(grid.months).toHaveLength(12);
    expect(grid.months[0]).toEqual({ monthKey: '2026-01', column: 0 });
    expect(grid.months[1]).toEqual({ monthKey: '2026-02', column: 4 }); // 1 February is the 32nd day, a Sunday
    const columns = grid.months.map((month) => month.column);
    expect([...columns].sort((a, b) => a - b)).toEqual(columns);
    for (let index = 1; index < columns.length; index++) expect(columns[index]! - columns[index - 1]!).toBeGreaterThanOrEqual(3);
  });

  it('is empty for no months', () => {
    expect(buildYearGrid([])).toEqual({ cells: [], months: [], columns: 0 });
  });
});

describe('buildMemberGrid', () => {
  const totals = Array.from({ length: 371 }, (_, index) => (index === 10 ? 3_600_000 : 0));
  const grid = buildMemberGrid({ startKey: '2025-11-17', totals, elapsedDays: 367 });

  it('lays out 53 whole weeks from a Monday, the days after today marked as future', () => {
    expect(grid.cells).toHaveLength(371);
    expect(grid.columns).toBe(53);
    expect(grid.cells[0]).toMatchObject({ dayKey: '2025-11-17', column: 0, row: 0, future: false });
    expect(grid.cells[10]).toMatchObject({ dayKey: '2025-11-27', column: 1, row: 3, totalMs: 3_600_000 });
    expect(grid.cells[366]!.future).toBe(false); // 18 November 2026, today
    expect(grid.cells[367]!.future).toBe(true);
    expect(grid.cells[370]).toMatchObject({ dayKey: '2026-11-22', column: 52, row: 6, future: true });
  });

  it('labels the months across the turn of the year, in order, never closer than three columns', () => {
    const labels = grid.months.map((month) => month.monthKey);
    expect(labels[0]).toBe('2025-12'); // the first month is cut by the start of the window (two columns), so it gets no label
    expect(labels.at(-1)).toBe('2026-11');
    const columns = grid.months.map((month) => month.column);
    for (let index = 1; index < columns.length; index++) expect(columns[index]! - columns[index - 1]!).toBeGreaterThanOrEqual(3);
  });
});

describe('buildDayGrid', () => {
  /** January days then fourteen February days, from a Monday: the labels the grid gives. */
  const labels = (januaryDays: number): string[] => {
    const days = [
      ...Array.from({ length: januaryDays }, (_, index) => ({ dayKey: `2026-01-${String(31 - januaryDays + 1 + index).padStart(2, '0')}`, totalMs: 0, future: false })),
      ...Array.from({ length: 14 }, (_, index) => ({ dayKey: `2026-02-${String(index + 1).padStart(2, '0')}`, totalMs: 0, future: false })),
    ];
    return buildDayGrid(days, 0).months.map((month) => month.monthKey);
  };

  it('drops the label of a month cut to two columns by the start of the window', () => {
    expect(labels(14)).toEqual(['2026-02']);
  });

  it('keeps it from three columns', () => {
    expect(labels(21)).toEqual(['2026-01', '2026-02']);
  });
});
