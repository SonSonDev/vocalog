import type { DayStrip, MonthStrip, Summary, WeekStrip, YearStrip } from '@vocalog/shared';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { weekdaysShort, binClock, formatDayShort, formatDuration, formatMonthLong, formatMonthName, formatMonthShort, formatPeople, formatWeekShort, isoWeekNumber, maxOf } from '../format.ts';
import { dayQuery, monthQuery, prefetchQuery, weekQuery, yearQuery } from '../queries.ts';
import { dayPath, monthPath, weekPath, yearPath } from '../router.ts';
import { Link } from './Link.tsx';

type Grain = 'days' | 'weeks' | 'months' | 'years';

const GRAINS: { id: Grain; label: string; title: string }[] = [
  { id: 'days', label: 'Jours', title: 'Jour par jour' },
  { id: 'weeks', label: 'Semaines', title: 'Semaine par semaine' },
  { id: 'months', label: 'Mois', title: 'Mois par mois' },
  { id: 'years', label: 'Années', title: 'Année par année' },
];

const GRAIN_KEY = 'vocalog-strips';
const INITIAL_ROWS: Record<Grain, number> = { days: 14, weeks: 8, months: 12, years: 6 };
const DAY_AXIS = ['6 h', '12 h', '18 h', '0 h', '6 h'];

function loadGrain(): Grain {
  try {
    const saved = window.localStorage.getItem(GRAIN_KEY);
    if (saved === 'days' || saved === 'weeks' || saved === 'months' || saved === 'years') return saved;
  } catch {
    // ignore: the choice is just not remembered
  }
  return 'days';
}

function saveGrain(grain: Grain): void {
  try {
    window.localStorage.setItem(GRAIN_KEY, grain);
  } catch {
    // ignore
  }
}

/**
 * The presence of the group as strips, by day, by week or by month. One hue, and the darker the cell the more people were
 * there (same idea as the heat map). Each line opens the page of that day, week or month. The choice is remembered.
 */
export function PeriodStrips({ summary, search }: { summary: Summary; search: string }) {
  const [grain, setGrain] = useState<Grain>(loadGrain);
  const guildId = summary.guild.id;
  const title = GRAINS.find((entry) => entry.id === grain)!.title;
  const choose = (next: Grain): void => {
    setGrain(next);
    saveGrain(next);
  };

  return (
    <section class="card" id="jours" aria-labelledby="strips-title">
      <div class="strips-head">
        <h2 id="strips-title">{title}</h2>
        <div class="segmented segmented-small" role="group" aria-label="Regrouper par">
          {GRAINS.map((entry) => (
            <button key={entry.id} type="button" aria-pressed={entry.id === grain} onClick={() => choose(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      {grain === 'days' && <DayRows days={summary.days} guildId={guildId} search={search} />}
      {grain === 'weeks' && <WeekRows weeks={summary.weeks} guildId={guildId} search={search} />}
      {grain === 'months' && <MonthRows months={summary.months} guildId={guildId} search={search} />}
      {grain === 'years' && <YearRows years={summary.years} guildId={guildId} search={search} />}
    </section>
  );
}

/** A list that shows its first rows and a button for the rest. */
function Expandable({ count, grain, children }: { count: number; grain: Grain; children: (limit: number) => ComponentChildren }) {
  const [expanded, setExpanded] = useState(false);
  const initial = INITIAL_ROWS[grain];
  const collapsible = count > initial + 1;
  return (
    <>
      {children(collapsible && !expanded ? initial : count)}
      {collapsible && (
        <button type="button" class="more" aria-expanded={expanded} aria-controls="jours" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Réduire la liste' : `Afficher les ${count} lignes`}
        </button>
      )}
    </>
  );
}

function DayRows({ days, guildId, search }: { days: DayStrip[]; guildId: string; search: string }) {
  const max = maxOf(days.map((day) => maxOf(day.bins)));
  return (
    <Expandable count={days.length} grain="days">
      {(limit) => (
        <div class="day-strips">
          <div class="day-row day-axis-row" aria-hidden="true">
            <span class="day-label" />
            <span class="day-axis">
              {DAY_AXIS.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </span>
            <span class="day-total" />
          </div>
          <ul class="day-list">
            {days.slice(0, limit).map((day) => {
              const label = formatDayShort(day.dayKey);
              const summary = day.totalMs > 0 ? `${formatDuration(day.totalMs)}, ${formatPeople(day.people)}, jusqu’à ${day.peak} en même temps` : 'personne en vocal';
              return (
                <li key={day.dayKey}>
                  <Link to={dayPath(day.dayKey, search)} class="day-row" onPrefetch={() => prefetchQuery(dayQuery(guildId, day.dayKey))}>
                    <span class="sr-only">{`${label} : ${summary}`}</span>
                    <span class="day-label" aria-hidden="true">
                      {label}
                    </span>
                    <span class="day-cells" aria-hidden="true">
                      {day.bins.map((value, index) => (
                        <span key={index} class="day-cell" style={{ '--v': max > 0 ? (value / max).toFixed(3) : '0' }} data-tip={`${label}, ${binClock(index, 30)}\n${formatPeople(value)}`} />
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
      )}
    </Expandable>
  );
}

function WeekRows({ weeks, guildId, search }: { weeks: WeekStrip[]; guildId: string; search: string }) {
  const max = maxOf(weeks.map((week) => maxOf(week.bins)));
  return (
    <Expandable count={weeks.length} grain="weeks">
      {(limit) => (
        <div class="day-strips week-strips">
          <div class="day-row day-axis-row" aria-hidden="true">
            <span class="day-label" />
            <span class="week-cells week-axis">
              {weekdaysShort().map((label) => (
                <span key={label} class="week-day">
                  {label}
                </span>
              ))}
            </span>
            <span class="day-total" />
          </div>
          <ul class="day-list">
            {weeks.slice(0, limit).map((week) => {
              const number = isoWeekNumber(week.startKey);
              const range = formatWeekShort(week.startKey);
              const summary = week.totalMs > 0 ? `${formatDuration(week.totalMs)}, ${formatPeople(week.people)}, jusqu’à ${week.peak} en même temps` : 'personne en vocal';
              return (
                <li key={week.startKey}>
                  <Link to={weekPath(week.startKey, search)} class="day-row" onPrefetch={() => prefetchQuery(weekQuery(guildId, week.startKey))}>
                    <span class="sr-only">{`Semaine ${number}, du ${range} : ${summary}`}</span>
                    <span class="day-label" aria-hidden="true">
                      <span class="lbl-main">S{number}</span>
                      <span class="lbl-sub">{range}</span>
                    </span>
                    <span class="week-cells" aria-hidden="true">
                      {weekdaysShort().map((weekday, dayIndex) => (
                        <span key={weekday} class="week-day">
                          {week.bins.slice(dayIndex * 24, dayIndex === 6 ? undefined : dayIndex * 24 + 24).map((value, index) => (
                            <span
                              key={index}
                              class="day-cell"
                              style={{ '--v': max > 0 ? (value / max).toFixed(3) : '0' }}
                              data-tip={`${weekday} ${binClock(index, 60)}\n${formatPeople(value)}`}
                            />
                          ))}
                        </span>
                      ))}
                    </span>
                    <span class="day-total mono" aria-hidden="true">
                      {week.totalMs > 0 ? formatDuration(week.totalMs) : '—'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Expandable>
  );
}

function MonthRows({ months, guildId, search }: { months: MonthStrip[]; guildId: string; search: string }) {
  const max = maxOf(months.map((month) => maxOf(month.dayTotals)));
  return (
    <Expandable count={months.length} grain="months">
      {(limit) => (
        <div class="day-strips month-strips">
          <div class="day-row day-axis-row" aria-hidden="true">
            <span class="day-label" />
            <span class="month-axis">
              {[1, 10, 20, 30].map((day) => (
                <span key={day} style={{ left: `${((day - 1) / 31) * 100}%` }}>
                  {day}
                </span>
              ))}
            </span>
            <span class="day-total" />
          </div>
          <ul class="day-list">
            {months.slice(0, limit).map((month) => {
              const label = formatMonthShort(month.monthKey);
              const summary = month.totalMs > 0 ? `${formatDuration(month.totalMs)}, ${formatPeople(month.people)}, jusqu’à ${month.peak} en même temps` : 'personne en vocal';
              return (
                <li key={month.monthKey}>
                  <Link to={monthPath(month.monthKey, search)} class="day-row" onPrefetch={() => prefetchQuery(monthQuery(guildId, month.monthKey))}>
                    <span class="sr-only">{`${formatMonthLong(month.monthKey)} : ${summary}`}</span>
                    <span class="day-label" aria-hidden="true">
                      <span class="lbl-main">{label}</span>
                    </span>
                    <span class="month-cells" aria-hidden="true">
                      {Array.from({ length: 31 }, (_, index) => {
                        const total = month.dayTotals[index];
                        if (total === undefined) return <span key={index} class="day-cell absent" />;
                        return (
                          <span
                            key={index}
                            class="day-cell"
                            style={{ '--v': max > 0 ? (total / max).toFixed(3) : '0' }}
                            data-tip={`${index + 1} ${label}\n${total > 0 ? formatDuration(total) : 'personne'}`}
                          />
                        );
                      })}
                    </span>
                    <span class="day-total mono" aria-hidden="true">
                      {month.totalMs > 0 ? formatDuration(month.totalMs) : '—'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Expandable>
  );
}

function YearRows({ years, guildId, search }: { years: YearStrip[]; guildId: string; search: string }) {
  const max = maxOf(years.flatMap((year) => year.monthTotals));
  return (
    <Expandable count={years.length} grain="years">
      {(limit) => (
        <div class="day-strips year-strips">
          <div class="day-row day-axis-row" aria-hidden="true">
            <span class="day-label" />
            <span class="year-cells year-axis">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index}>{formatMonthName(`2000-${String(index + 1).padStart(2, '0')}`).slice(0, 1).toUpperCase()}</span>
              ))}
            </span>
            <span class="day-total" />
          </div>
          <ul class="day-list">
            {years.slice(0, limit).map((year) => {
              const summary = year.totalMs > 0 ? `${formatDuration(year.totalMs)}, ${formatPeople(year.people)}, jusqu’à ${year.peak} en même temps` : 'personne en vocal';
              return (
                <li key={year.yearKey}>
                  <Link to={yearPath(year.yearKey, search)} class="day-row" onPrefetch={() => prefetchQuery(yearQuery(guildId, year.yearKey))}>
                    <span class="sr-only">{`${year.yearKey} : ${summary}`}</span>
                    <span class="day-label" aria-hidden="true">
                      <span class="lbl-main">{year.yearKey}</span>
                    </span>
                    <span class="year-cells" aria-hidden="true">
                      {year.monthTotals.map((total, index) => {
                        const monthKey = `${year.yearKey}-${String(index + 1).padStart(2, '0')}`;
                        return (
                          <span
                            key={monthKey}
                            class="day-cell"
                            style={{ '--v': max > 0 ? (total / max).toFixed(3) : '0' }}
                            data-tip={`${formatMonthName(monthKey)} ${year.yearKey}\n${total > 0 ? formatDuration(total) : 'personne'}`}
                          />
                        );
                      })}
                    </span>
                    <span class="day-total mono" aria-hidden="true">
                      {year.totalMs > 0 ? formatDuration(year.totalMs) : '—'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Expandable>
  );
}
