import { useEffect, useRef } from 'preact/hooks';
import { weekdaysShort, formatDayShort, formatDuration, formatMonthAbbr, maxOf } from '../format.ts';
import type { YearGrid } from '../yearGrid.ts';

/**
 * Weeks as columns (first day of the week at the top), weekdays as rows, one cell per day, darker for more voice time, like the contributions
 * of a code hosting site. On a phone it scrolls sideways (53 columns would be 6 px each); `scrollToEnd` starts it at the
 * latest weeks. The labels are part of the same grid, so they always line up with the cells.
 */
export function ContributionGrid({ grid, label, scrollToEnd, resetKey }: { grid: YearGrid; label: string; scrollToEnd: boolean; resetKey: string }) {
  const max = maxOf(grid.cells.map((cell) => cell.totalMs));
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = scrollToEnd ? element.scrollWidth : 0;
  }, [resetKey]);

  return (
    <div class="gh-scroll" ref={scroller}>
      <div class="gh" style={{ '--cols': String(grid.columns) }} role="img" aria-label={label}>
        {grid.months.map((month) => (
          <span key={month.monthKey} class="gh-month" style={{ gridColumn: `${month.column + 2} / span ${Math.min(3, grid.columns - month.column)}`, gridRow: 1 }}>
            {formatMonthAbbr(month.monthKey)}
          </span>
        ))}
        {[0, 2, 4].map((row) => (
          <span key={row} class="gh-dow" style={{ gridRow: row + 2 }}>
            {weekdaysShort()[row]}
          </span>
        ))}
        {grid.cells.map((cell) => (
          <span
            key={cell.dayKey}
            class={cell.future ? 'gh-cell future' : 'gh-cell'}
            style={{ gridColumn: cell.column + 2, gridRow: cell.row + 2, '--v': max > 0 ? (cell.totalMs / max).toFixed(3) : '0' }}
            data-tip={cell.future ? undefined : `${formatDayShort(cell.dayKey)}\n${cell.totalMs > 0 ? formatDuration(cell.totalMs) : 'personne'}`}
          />
        ))}
      </div>
    </div>
  );
}
