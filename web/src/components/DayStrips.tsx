import type { DayStrip } from '@vocalog/shared';
import { useState } from 'preact/hooks';
import { binClock, formatDayShort, formatDuration, formatPeople, maxOf } from '../format.ts';
import { dayPath } from '../router.ts';
import { Link } from './Link.tsx';

const INITIAL_DAYS = 14;
const STRIP_BIN_MINUTES = 30;
const AXIS = ['6 h', '12 h', '18 h', '0 h', '6 h'];

/**
 * One line per day, from 6 h to 6 h so an evening that passes midnight stays in one piece. One hue, and the darker the
 * cell the more people were there (same idea as the heat map). Each line opens the page of that day.
 */
export function DayStrips({ days, search }: { days: DayStrip[]; search: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = days.length > INITIAL_DAYS + 1;
  const shown = collapsible && !expanded ? days.slice(0, INITIAL_DAYS) : days;
  const max = maxOf(days.map((day) => maxOf(day.bins)));

  return (
    <section class="card" id="jours" aria-labelledby="days-title">
      <h2 id="days-title">Jour par jour</h2>
      <div class="day-strips">
        <div class="day-row day-axis-row" aria-hidden="true">
          <span class="day-label" />
          <span class="day-axis">
            {AXIS.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </span>
          <span class="day-total" />
        </div>
        <ul class="day-list">
          {shown.map((day) => {
            const label = formatDayShort(day.dayKey);
            const summary = day.totalMs > 0 ? `${formatDuration(day.totalMs)}, ${formatPeople(day.people)}, jusqu’à ${day.peak} en même temps` : 'personne en vocal';
            return (
              <li key={day.dayKey}>
                <Link to={dayPath(day.dayKey, search)} class="day-row">
                  <span class="sr-only">{`${label} : ${summary}`}</span>
                  <span class="day-label" aria-hidden="true">
                    {label}
                  </span>
                  <span class="day-cells" aria-hidden="true">
                    {day.bins.map((value, index) => (
                      <span
                        key={index}
                        class="day-cell"
                        style={{ '--v': max > 0 ? (value / max).toFixed(3) : '0' }}
                        data-tip={`${label}, ${binClock(index, STRIP_BIN_MINUTES)}
${formatPeople(value)}`}
                      />
                    ))}
                  </span>
                  <span class="day-total mono" aria-hidden="true">
                    {day.totalMs > 0 ? formatDuration(day.totalMs) : '—'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {collapsible && (
        <button type="button" class="more" aria-expanded={expanded} aria-controls="jours" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Réduire la liste' : `Afficher les ${days.length} jours`}
        </button>
      )}
    </section>
  );
}
