import type { MonthView, Period } from '@vocalog/shared';
import { useEffect } from 'preact/hooks';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { PeriodNav } from '../components/PeriodNav.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import { WEEKDAYS_SHORT, formatClock, formatCompactDuration, formatDateTime, formatDayLong, formatDayShort, formatDayWeekday, formatDuration, formatMonthLong, formatPeople, isoWeekNumber, maxOf } from '../format.ts';
import { dayQuery, monthQuery, prefetchQuery, weekQuery } from '../queries.ts';
import { dayPath, monthPath, weekPath } from '../router.ts';
import { useRemote } from '../useRemote.ts';

interface Props {
  guildId: string | null;
  monthKey: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, kept on every link. */
  search: string;
  controls: Controls;
}

export function MonthPageView({ guildId, monthKey, search, controls }: Props) {
  const query = guildId === null ? null : monthQuery(guildId, monthKey);
  const { data: month, status, retry } = useRemote(query?.key ?? null, () => query!.load());

  useEffect(() => {
    if (!month || guildId === null) return;
    const timer = window.setTimeout(() => {
      for (const neighbour of [month.prevMonthKey, month.nextMonthKey]) if (neighbour) prefetchQuery(monthQuery(guildId, neighbour));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [month?.monthKey, guildId]);

  return (
    <>
      <Header controls={controls} title={formatMonthLong(monthKey)} back={{ to: `/${search}`, label: 'Tableau de bord' }} showPeriod={false} />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger ce mois. Vérifie que le mois existe et que le serveur est démarré.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="month" />}

      {month !== null && guildId !== null && (
        <div class="content">
          <MonthNav month={month} guildId={guildId} search={search} />
          {month.activeDays === 0 ? (
            <p class="notice" role="status">
              Personne n’était en vocal ce mois-là.
            </p>
          ) : (
            <MonthFigures month={month} />
          )}
          <Calendar month={month} guildId={guildId} search={search} />
          <p class="footnote">
            Fuseau horaire : {month.timeZone} · mis à jour à {formatClock(month.generatedAtMs, month.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}

function MonthNav({ month, guildId, search }: { month: MonthView; guildId: string; search: string }) {
  const target = (key: string) => ({ to: monthPath(key, search), label: formatMonthLong(key), onPrefetch: () => prefetchQuery(monthQuery(guildId, key)) });
  return <PeriodNav prev={month.prevMonthKey ? target(month.prevMonthKey) : null} next={month.nextMonthKey ? target(month.nextMonthKey) : null} prevEnd="Début des données" nextEnd="Ce mois-ci" />;
}

function MonthFigures({ month }: { month: MonthView }) {
  const figures = [
    { label: 'Temps total', value: formatDuration(month.totalMs), note: `${month.people} personne${month.people > 1 ? 's' : ''} différente${month.people > 1 ? 's' : ''}` },
    { label: 'Jours actifs', value: String(month.activeDays), note: month.activeDays > 0 ? `${formatDuration(month.totalMs / month.activeDays)} par jour actif` : undefined },
    { label: 'Jour le plus actif', value: month.busiest ? formatDayWeekday(month.busiest.dayKey) : '—', note: month.busiest ? formatDuration(month.busiest.totalMs) : undefined },
    { label: 'Plus de monde en même temps', value: month.peak ? String(month.peak.count) : '—', note: month.peak ? formatDateTime(month.peak.atMs, month.timeZone) : undefined },
  ];
  return (
    <dl class="figures" aria-label="Chiffres clés du mois">
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

/** The month as a calendar: one cell per day, tinted and filled at the bottom in proportion to the group's time that day. */
function Calendar({ month, guildId, search }: { month: MonthView; guildId: string; search: string }) {
  const max = maxOf(month.weeks.flatMap((week) => week.days.map((day) => day?.totalMs ?? 0)));
  return (
    <section class="card" aria-labelledby="calendar-title">
      <h2 id="calendar-title" class="sr-only">
        Calendrier du mois
      </h2>
      <div class="cal">
        <div class="cal-head" aria-hidden="true">
          <span />
          {WEEKDAYS_SHORT.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        {month.weeks.map((week) => (
          <div class="cal-row" key={week.mondayKey}>
            <Link to={weekPath(week.mondayKey, search)} class="cal-week" onPrefetch={() => prefetchQuery(weekQuery(guildId, week.mondayKey))}>
              <span class="sr-only">Semaine </span>S{isoWeekNumber(week.mondayKey)}
            </Link>
            {week.days.map((day, index) => {
              if (day === null || day.future) {
                return (
                  <span key={index} class="cal-cell cal-empty" aria-hidden="true">
                    {day ? <span class="cal-num">{Number(day.dayKey.slice(8))}</span> : null}
                  </span>
                );
              }
              const level = max > 0 ? day.totalMs / max : 0;
              const label = formatDayLong(day.dayKey);
              const text = day.totalMs > 0 ? `${formatDuration(day.totalMs)}, ${formatPeople(day.people)}, jusqu’à ${day.peak} en même temps` : 'personne en vocal';
              return (
                <Link
                  key={day.dayKey}
                  to={dayPath(day.dayKey, search)}
                  class="cal-cell"
                  onPrefetch={() => prefetchQuery(dayQuery(guildId, day.dayKey))}
                >
                  <span class="sr-only">{`${label} : ${text}`}</span>
                  <span class="cal-fill" style={{ '--v': level.toFixed(3) }} aria-hidden="true" data-tip={`${formatDayShort(day.dayKey)}\n${day.totalMs > 0 ? `${formatDuration(day.totalMs)} · ${formatPeople(day.people)}` : 'personne'}`}>
                    <span class="cal-num">{Number(day.dayKey.slice(8))}</span>
                    <span class="cal-dur mono">
                      <span class="cal-long">{day.totalMs > 0 ? formatDuration(day.totalMs) : ''}</span>
                      <span class="cal-short">{formatCompactDuration(day.totalMs)}</span>
                    </span>
                    <span class="cal-bar" />
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
