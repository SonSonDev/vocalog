import type { Period, WeekView } from '@vocalog/shared';
import { monthOf } from '@vocalog/shared';
import { useEffect } from 'preact/hooks';
import { Avatar } from '../components/Avatar.tsx';
import { TimelineTrack } from '../charts/Timeline.tsx';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { PeriodNav } from '../components/PeriodNav.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import { weekStartOf } from '@vocalog/shared';
import { getSettings } from '../settings.ts';
import { weekdaysShort, binClock, formatClock, formatDateTime, formatDayWeekday, formatDuration, formatPeople, formatWeekRange, isoWeekNumber, maxOf } from '../format.ts';
import { monthQuery, prefetchQuery, weekQuery } from '../queries.ts';
import { dayPath, memberPath, monthPath, weekPath } from '../router.ts';
import { useRemote } from '../useRemote.ts';

interface Props {
  guildId: string | null;
  startKey: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, kept on every link. */
  search: string;
  controls: Controls;
}

export function WeekPageView({ guildId, startKey: urlKey, search, controls }: Props) {
  const startKey = weekStartOf(urlKey, getSettings().weekStart);
  const query = guildId === null ? null : weekQuery(guildId, startKey);
  const { data: week, status, retry } = useRemote(query?.key ?? null, () => query!.load());

  // Once a week is on screen, its neighbours load quietly: the next click on "previous" or "next" is instant.
  useEffect(() => {
    if (!week || guildId === null) return;
    const timer = window.setTimeout(() => {
      for (const neighbour of [week.prevStartKey, week.nextStartKey]) if (neighbour) prefetchQuery(weekQuery(guildId, neighbour));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [week?.startKey, guildId]);

  return (
    <>
      <Header controls={controls} title={`Semaine du ${formatWeekRange(startKey)}`} back={{ to: `/${search}`, label: 'Tableau de bord' }} showPeriod={false} />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger cette semaine. Vérifie que la date existe et que le serveur est démarré.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="week" />}

      {week !== null && guildId !== null && (
        <div class="content">
          <WeekNav week={week} guildId={guildId} search={search} />
          {week.members.length === 0 ? (
            <p class="notice" role="status">
              Personne n’était en vocal cette semaine-là.
            </p>
          ) : (
            <>
              <WeekFigures week={week} />
              <WeekTimeline week={week} guildId={guildId} search={search} />
            </>
          )}
          <p class="footnote">
            Fuseau horaire : {week.timeZone} · mis à jour à {formatClock(week.generatedAtMs, week.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}

function WeekNav({ week, guildId, search }: { week: WeekView; guildId: string; search: string }) {
  const weekTarget = (key: string, label: string) => ({ to: weekPath(key, search), label, onPrefetch: () => prefetchQuery(weekQuery(guildId, key)) });
  // The month of the middle of the week: a week that straddles two months belongs mostly to one of them.
  const month = monthOf(new Date(Date.parse(`${week.startKey}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10));
  return (
    <PeriodNav
      prev={week.prevStartKey ? weekTarget(week.prevStartKey, `Semaine ${isoWeekNumber(week.prevStartKey)}`) : null}
      next={week.nextStartKey ? weekTarget(week.nextStartKey, `Semaine ${isoWeekNumber(week.nextStartKey)}`) : null}
      prevEnd="Début des données"
      nextEnd="Cette semaine"
      middle={[{ to: monthPath(month, search), label: 'Mois', onPrefetch: () => prefetchQuery(monthQuery(guildId, month)) }]}
    />
  );
}

function WeekFigures({ week }: { week: WeekView }) {
  const busiest = week.days.reduce((best, day) => (day.totalMs > best.totalMs ? day : best), week.days[0]!);
  const figures = [
    { label: 'Temps total', value: formatDuration(week.totalMs), note: `semaine ${isoWeekNumber(week.startKey)}` },
    { label: 'Présents', value: String(week.members.length) },
    { label: 'Jour le plus actif', value: formatDayWeekday(busiest.dayKey), note: formatDuration(busiest.totalMs) },
    { label: 'Plus de monde en même temps', value: week.peak ? String(week.peak.count) : '—', note: week.peak ? formatDateTime(week.peak.atMs, week.timeZone) : undefined },
  ];
  return (
    <dl class="figures" aria-label="Chiffres clés de la semaine">
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

function WeekTimeline({ week, guildId, search }: { week: WeekView; guildId: string; search: string }) {
  const length = week.endMs - week.startMs;
  const percent = (ms: number): number => ((ms - week.startMs) / length) * 100;
  const maxBin = maxOf(week.bins);
  const separators = week.days.slice(1).map((day) => percent(day.startMs));

  return (
    <section class="card" aria-labelledby="week-title">
      <h2 id="week-title" class="sr-only">
        Chronologie de la semaine
      </h2>
      <div class="timeline week-timeline">
        <div class="tl-row tl-axis-row">
          <span class="tl-name" />
          <span class="wk-axis">
            {week.days.map((day, index) => (
              <Link key={day.dayKey} to={dayPath(day.dayKey, search)} class="wk-day" onPrefetch={() => undefined}>
                <span class="wk-dow">{weekdaysShort()[index]}</span>
                <span class="wk-num">{Number(day.dayKey.slice(8))}</span>
              </Link>
            ))}
          </span>
        </div>
        <div class="tl-row">
          <span class="tl-name">
            <span class="avatar-spacer" />
            <span class="tl-text">
              <span class="tl-who muted">Présence</span>
            </span>
          </span>
          <span class="tl-track tl-cells" aria-hidden="true">
            {week.bins.map((value, index) => (
              <span
                key={index}
                class="day-cell"
                style={{ '--v': maxBin > 0 ? (value / maxBin).toFixed(3) : '0' }}
                data-tip={`${weekdaysShort()[Math.min(6, Math.floor(index / 24))]} ${binClock(index % 24, 60)}\n${formatPeople(value)}`}
              />
            ))}
            {separators.map((left) => (
              <span key={left} class="wk-sep" style={{ left: `${left}%` }} />
            ))}
          </span>
        </div>
        {week.members.map((member) => (
          <div class="tl-row" key={member.user.id}>
            <span class="tl-name">
              <Avatar user={member.user} guildId={guildId} size={28} />
              <span class="tl-text">
                <Link to={memberPath(member.user.id, search)} class="tl-who">
                  {member.user.name}
                </Link>
                <span class="tl-sub muted mono">{formatDuration(member.totalMs)}</span>
              </span>
            </span>
            <TimelineTrack
              spans={member.spans.map((span) => ({
                startMs: span.startMs,
                endMs: span.endMs,
                tip: `${span.channel.name}
${formatDateTime(span.startMs, week.timeZone)}–${formatClock(span.endMs, week.timeZone)} · ${formatDuration(span.endMs - span.startMs)}`,
              }))}
              fromMs={week.startMs}
              toMs={week.endMs}
            >
              {separators.map((left) => (
                <span key={left} class="wk-sep" style={{ left: `${left}%` }} />
              ))}
            </TimelineTrack>
          </div>
        ))}
      </div>
      <details class="tl-table">
        <summary>Voir en tableau</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Membre</th>
              <th scope="col">Plages de présence</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {week.members.map((member) => (
              <tr key={member.user.id}>
                <th scope="row">{member.user.name}</th>
                <td>
                  {member.spans.map((span, index) => (
                    <span class="tl-table-span" key={index}>
                      {formatDateTime(span.startMs, week.timeZone)}–{formatClock(span.endMs, week.timeZone)} · {span.channel.name}
                    </span>
                  ))}
                </td>
                <td class="mono">{formatDuration(member.totalMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
