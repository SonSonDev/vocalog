import { getSettings } from '../settings.ts';
import { weekStartOf, monthOf } from '@vocalog/shared';
import type { DayView, Period } from '@vocalog/shared';
import { useEffect, useState } from 'preact/hooks';
import { PeriodNav } from '../components/PeriodNav.tsx';
import { dayQuery, monthQuery, prefetchQuery, weekQuery } from '../queries.ts';
import { Avatar } from '../components/Avatar.tsx';
import { TimelineTrack } from '../charts/Timeline.tsx';
import { Header } from '../components/Header.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import type { Controls } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { binClock, formatClock, formatDayLong, formatDayShort, formatDuration, formatHourLabel, formatPeople, maxOf, timelineView } from '../format.ts';
import { dayPath, memberPath, monthPath, weekPath } from '../router.ts';
import { useRemote } from '../useRemote.ts';

const DAY_BIN_MINUTES = 15;
const BIN_MS = DAY_BIN_MINUTES * 60_000;
const HOUR_MS = 3_600_000;

interface Props {
  guildId: string | null;
  dayKey: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, kept on every link. */
  search: string;
  controls: Controls;
}

const ZOOM_KEY = 'vocalog-day-zoom';

function loadZoomed(): boolean {
  try {
    return window.localStorage.getItem(ZOOM_KEY) !== 'false';
  } catch {
    return true;
  }
}

function saveZoomed(zoomed: boolean): void {
  try {
    window.localStorage.setItem(ZOOM_KEY, String(zoomed));
  } catch {
    // ignore: the choice just is not remembered after a reload
  }
}

export function DayPageView({ guildId, dayKey, search, controls }: Props) {
  // Kept here, not in the timeline: the timeline disappears while the next day loads, and the choice must survive that.
  const [zoomed, setZoomed] = useState(loadZoomed);
  const toggleZoom = (): void => {
    setZoomed(!zoomed);
    saveZoomed(!zoomed);
  };
  const query = guildId === null ? null : dayQuery(guildId, dayKey);
  const { data: day, status, retry } = useRemote(query?.key ?? null, () => query!.load());

  // Once a day is on screen, its neighbours load quietly: the next click on "previous" or "next" is instant.
  useEffect(() => {
    if (!day || guildId === null) return;
    const timer = window.setTimeout(() => {
      for (const neighbour of [day.prevDayKey, day.nextDayKey]) if (neighbour) prefetchQuery(dayQuery(guildId, neighbour));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [day?.dayKey, guildId]);

  return (
    <>
      <Header controls={controls} title={formatDayLong(dayKey)} back={{ to: `/${search}`, label: 'Tableau de bord' }} showPeriod={false} />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger ce jour. Vérifie que la date existe et que le serveur est démarré.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="day" />}

      {day !== null && guildId !== null && (
        <div class="content">
          <DayNav day={day} guildId={guildId} search={search} />
          {day.members.length === 0 ? (
            <p class="notice" role="status">
              Personne n’était en vocal ce jour-là.
            </p>
          ) : (
            <>
              <DayFigures day={day} />
              <Timeline day={day} guildId={guildId} search={search} zoomed={zoomed} onToggleZoom={toggleZoom} />
            </>
          )}
          <p class="footnote">
            Fuseau horaire : {day.timeZone} · mis à jour à {formatClock(day.generatedAtMs, day.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}

function DayNav({ day, guildId, search }: { day: DayView; guildId: string; search: string }) {
  const dayTarget = (key: string) => ({ to: dayPath(key, search), label: formatDayShort(key), onPrefetch: () => prefetchQuery(dayQuery(guildId, key)) });
  const monday = weekStartOf(day.dayKey, getSettings().weekStart);
  const month = monthOf(day.dayKey);
  return (
    <PeriodNav
      prev={day.prevDayKey ? dayTarget(day.prevDayKey) : null}
      next={day.nextDayKey ? dayTarget(day.nextDayKey) : null}
      prevEnd="Début des données"
      nextEnd="Aujourd’hui"
      middle={[
        { to: weekPath(monday, search), label: 'Semaine', onPrefetch: () => prefetchQuery(weekQuery(guildId, monday)) },
        { to: monthPath(month, search), label: 'Mois', onPrefetch: () => prefetchQuery(monthQuery(guildId, month)) },
      ]}
    />
  );
}

function DayFigures({ day }: { day: DayView }) {
  const figures = [
    { label: 'Temps total', value: formatDuration(day.totalMs) },
    { label: 'Présents', value: String(day.members.length) },
    {
      label: 'Plus de monde en même temps',
      value: day.peak ? String(day.peak.count) : '—',
      note: day.peak ? `vers ${formatClock(day.peak.atMs, day.timeZone)}` : 'aucun',
    },
  ];
  return (
    <dl class="figures three" aria-label="Chiffres clés du jour">
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

function Timeline({ day, guildId, search, zoomed, onToggleZoom }: { day: DayView; guildId: string; search: string; zoomed: boolean; onToggleZoom: () => void }) {
  const firstMs = Math.min(...day.members.map((member) => member.spans[0]!.startMs));
  const lastMs = Math.max(...day.members.flatMap((member) => member.spans.map((span) => span.endMs)));
  // Zoomed: only the hours where something happened, so bars are wide enough to read. Otherwise the whole day, 6 h to 6 h.
  const view = zoomed ? timelineView(day, firstMs, lastMs) : { startMs: day.startMs, endMs: day.endMs, stepMs: 3 * HOUR_MS };
  const length = view.endMs - view.startMs;
  const tickPercent = (view.stepMs / length) * 100;
  const ticks: number[] = [];
  for (let at = 0; at <= length; at += view.stepMs) ticks.push(at);

  const firstBin = Math.max(0, Math.floor((view.startMs - day.startMs) / BIN_MS));
  const lastBin = Math.min(day.bins.length, Math.ceil((view.endMs - day.startMs) / BIN_MS));
  const bins = day.bins.slice(firstBin, lastBin);
  const maxBin = maxOf(bins);
  const trackStyle = { '--tick': `${tickPercent}%` };

  return (
    <section class="card" aria-labelledby="timeline-title">
      <div class="tl-head">
        <h2 id="timeline-title" class="sr-only">
          Chronologie du jour
        </h2>
        <button type="button" class="tl-zoom" aria-pressed={!zoomed} onClick={onToggleZoom}>
          {zoomed ? 'Voir la journée entière' : 'Zoomer sur l’activité'}
        </button>
      </div>
      <div class="timeline">
        <div class="tl-row tl-axis-row" aria-hidden="true">
          <span class="tl-name" />
          <span class="tl-axis">
            {ticks.map((at) => (
              <span key={at} style={{ left: `${(at / length) * 100}%` }} class={at === 0 ? 'first' : at === length ? 'last' : undefined}>
                {formatHourLabel(view.startMs + at, day.timeZone)}
              </span>
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
            {bins.map((value, index) => (
              <span
                key={index}
                class="day-cell"
                style={{ '--v': maxBin > 0 ? (value / maxBin).toFixed(3) : '0' }}
                data-tip={`${binClock(firstBin + index, DAY_BIN_MINUTES)}
${formatPeople(value)}`}
              />
            ))}
          </span>
        </div>
        {day.members.map((member) => (
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
                label: span.channel.name,
                tip: `${span.channel.name}
${formatClock(span.startMs, day.timeZone)}–${formatClock(span.endMs, day.timeZone)} · ${formatDuration(span.endMs - span.startMs)}`,
              }))}
              fromMs={view.startMs}
              toMs={view.endMs}
              style={trackStyle}
            />
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
            {day.members.map((member) => (
              <tr key={member.user.id}>
                <th scope="row">{member.user.name}</th>
                <td>
                  {member.spans.map((span, index) => (
                    <span class="tl-table-span" key={index}>
                      {formatClock(span.startMs, day.timeZone)}–{formatClock(span.endMs, day.timeZone)} · {span.channel.name}
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
