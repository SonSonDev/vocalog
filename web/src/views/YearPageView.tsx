import type { Period, YearView } from '@vocalog/shared';
import { useEffect, useState } from 'preact/hooks';
import { ContributionGrid } from '../components/ContributionGrid.tsx';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { PeriodNav } from '../components/PeriodNav.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import { weekdayOrder, formatClock, formatDayKey, formatDayShort, formatDuration, formatMonthName, maxOf } from '../format.ts';
import { monthQuery, prefetchQuery, yearQuery } from '../queries.ts';
import { monthPath, yearPath } from '../router.ts';
import { useRemote } from '../useRemote.ts';
import { buildYearGrid } from '../yearGrid.ts';

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const initials = (): string[] => weekdayOrder().map((index) => WEEKDAY_INITIALS[index]!);

interface Props {
  guildId: string | null;
  yearKey: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, kept on every link. */
  search: string;
  controls: Controls;
}

export function YearPageView({ guildId, yearKey, search, controls }: Props) {
  const query = guildId === null ? null : yearQuery(guildId, yearKey);
  const { data: year, status, retry } = useRemote(query?.key ?? null, () => query!.load());

  useEffect(() => {
    if (!year || guildId === null) return;
    const timer = window.setTimeout(() => {
      for (const neighbour of [year.prevYearKey, year.nextYearKey]) if (neighbour) prefetchQuery(yearQuery(guildId, neighbour));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [year?.yearKey, guildId]);

  return (
    <>
      <Header controls={controls} title={yearKey} back={{ to: `/${search}`, label: 'Tableau de bord' }} showPeriod={false} />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger cette année. Vérifie que l’année existe et que le serveur est démarré.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="year" />}

      {year !== null && guildId !== null && (
        <div class="content">
          <YearNav year={year} guildId={guildId} search={search} />
          {year.activeDays === 0 ? (
            <p class="notice" role="status">
              Personne n’était en vocal cette année-là.
            </p>
          ) : (
            <YearFigures year={year} />
          )}
          <YearCard year={year} guildId={guildId} search={search} />
          <p class="footnote">
            Fuseau horaire : {year.timeZone} · mis à jour à {formatClock(year.generatedAtMs, year.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}

function YearNav({ year, guildId, search }: { year: YearView; guildId: string; search: string }) {
  const target = (key: string) => ({ to: yearPath(key, search), label: key, onPrefetch: () => prefetchQuery(yearQuery(guildId, key)) });
  return <PeriodNav prev={year.prevYearKey ? target(year.prevYearKey) : null} next={year.nextYearKey ? target(year.nextYearKey) : null} prevEnd="Début des données" nextEnd="Cette année" />;
}

function YearFigures({ year }: { year: YearView }) {
  const figures = [
    { label: 'Temps total', value: formatDuration(year.totalMs), note: `${year.people} personne${year.people > 1 ? 's' : ''} différente${year.people > 1 ? 's' : ''}` },
    { label: 'Jours actifs', value: String(year.activeDays), note: year.activeDays > 0 ? `${formatDuration(year.totalMs / year.activeDays)} par jour actif` : undefined },
    { label: 'Mois le plus actif', value: year.busiestMonth ? formatMonthName(year.busiestMonth.monthKey) : '—', note: year.busiestMonth ? formatDuration(year.busiestMonth.totalMs) : undefined },
    { label: 'Jour record', value: year.busiestDay ? formatDayKey(year.busiestDay.dayKey) : '—', note: year.busiestDay ? formatDuration(year.busiestDay.totalMs) : undefined },
    {
      label: 'Plus longue série',
      value: year.longestStreak ? `${year.longestStreak.days} j` : '—',
      note: year.longestStreak && year.longestStreak.days > 1 ? `du ${formatDayKey(year.longestStreak.startKey)} au ${formatDayKey(year.longestStreak.endKey)}` : undefined,
    },
  ];
  return (
    <dl class="figures five" aria-label="Chiffres clés de l’année">
      {figures.map((figure) => (
        <div class="figure" key={figure.label}>
          <dt>{figure.label}</dt>
          <dd class="figure-value">{figure.value}</dd>
          {figure.note && <dd class="figure-note">{figure.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

const VIEW_KEY = 'vocalog-year-view';
type YearDisplay = 'grid' | 'months';

function loadDisplay(): YearDisplay {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'months' ? 'months' : 'grid';
  } catch {
    return 'grid';
  }
}

function saveDisplay(display: YearDisplay): void {
  try {
    window.localStorage.setItem(VIEW_KEY, display);
  } catch {
    // ignore: the choice is just not remembered
  }
}

/** The year as a contribution-style grid, or as twelve month calendars. The choice is remembered. */
function YearCard({ year, guildId, search }: { year: YearView; guildId: string; search: string }) {
  const [display, setDisplay] = useState<YearDisplay>(loadDisplay);
  const choose = (next: YearDisplay): void => {
    setDisplay(next);
    saveDisplay(next);
  };
  return (
    <section class="card" aria-labelledby="year-calendar-title">
      <div class="strips-head year-head">
        <h2 id="year-calendar-title" class="sr-only">
          Calendrier de l’année
        </h2>
        <div class="segmented" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={display === 'grid'} onClick={() => choose('grid')}>
            Grille
          </button>
          <button type="button" aria-pressed={display === 'months'} onClick={() => choose('months')}>
            Mois
          </button>
        </div>
      </div>
      {display === 'grid' ? (
        <ContributionGrid
          grid={buildYearGrid(year.months)}
          label={`Calendrier de l’année : ${year.activeDays} jour${year.activeDays > 1 ? 's' : ''} avec du vocal, une case par jour.`}
          scrollToEnd={year.nextYearKey === null}
          resetKey={year.yearKey}
        />
      ) : <MonthCalendars year={year} guildId={guildId} search={search} />}
    </section>
  );
}

/** Twelve small calendars, one per month: a cell per day, darker for more voice time. A month's title opens that month. */
function MonthCalendars({ year, guildId, search }: { year: YearView; guildId: string; search: string }) {
  const max = maxOf(year.months.flatMap((month) => month.days.map((day) => day.totalMs)));
  return (
    <div class="year-grid">
      {year.months.map((month) => (
        <div class="mini-cal" key={month.monthKey}>
          <Link to={monthPath(month.monthKey, search)} class="mini-title" onPrefetch={() => prefetchQuery(monthQuery(guildId, month.monthKey))}>
            <span>{formatMonthName(month.monthKey)}</span>
            <span class="mini-total mono">{month.totalMs > 0 ? formatDuration(month.totalMs) : ''}</span>
            <span class="sr-only">{month.totalMs > 0 ? ` : ${formatDuration(month.totalMs)}, ${month.activeDays} jour${month.activeDays > 1 ? 's' : ''} actif${month.activeDays > 1 ? 's' : ''}` : ' : personne en vocal'}</span>
          </Link>
          <div class="mini-days" aria-hidden="true">
            {initials().map((initial, index) => (
              <span key={index} class="mini-dow">
                {initial}
              </span>
            ))}
            {Array.from({ length: month.firstWeekday }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {month.days.map((day) => (
              <span
                key={day.dayKey}
                class={day.future ? 'mini-cell future' : 'mini-cell'}
                style={{ '--v': max > 0 ? (day.totalMs / max).toFixed(3) : '0' }}
                data-tip={day.future ? undefined : `${formatDayShort(day.dayKey)}\n${day.totalMs > 0 ? formatDuration(day.totalMs) : 'personne'}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
