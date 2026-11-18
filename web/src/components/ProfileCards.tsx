import type { MemberProfile } from '@vocalog/shared';
import { Handle } from './Handle.tsx';
import {
  barPercent,
  describeTimeDifference,
  formatDateTime,
  formatDayKey,
  formatDuration,
  formatMinuteOfDay,
  formatPercent,
  formatRank,
  formatSignedPercent,
  maxOf,
  shareOf,
} from '../format.ts';

export function MemberFigures({ profile }: { profile: MemberProfile }) {
  const change = profile.habits.changePercent;
  const longest = profile.longestSession;
  const figures = [
    {
      label: 'Temps total',
      value: formatDuration(profile.totalMs),
      note: change === null ? 'rien à comparer avant cette période' : `${formatSignedPercent(change)} par rapport à la période précédente`,
    },
    { label: 'Moyenne par jour', value: formatDuration(profile.avgPerDayMs), note: `sur ${profile.days} jour${profile.days > 1 ? 's' : ''}` },
    {
      label: 'Sessions',
      value: String(profile.sessions),
      note: profile.sessions > 0 ? `${formatDuration(profile.avgSessionMs)} en moyenne` : 'aucune',
    },
    {
      label: 'Plus longue session',
      value: longest ? formatDuration(longest.durationMs) : '—',
      note: longest ? `${longest.channel.name}, ${formatDateTime(longest.startMs, profile.timeZone)}` : 'aucune',
    },
    { label: 'Série en cours', value: `${profile.streak.current} j`, note: `record : ${profile.streak.best} j` },
  ];
  return (
    <dl class="figures five" aria-label="Chiffres clés du membre">
      {figures.map((figure) => (
        <div class="figure" key={figure.label}>
          <dt>{figure.label}</dt>
          <dd class="figure-value">{figure.value}</dd>
          <dd class="figure-note">{figure.note}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ActivityChart({ activity }: { activity: MemberProfile['activity'] }) {
  const { granularity, buckets } = activity;
  const max = maxOf(buckets.map((bucket) => bucket.ms));
  const best = buckets.reduce((top, bucket) => (bucket.ms > top.ms ? bucket : top), buckets[0] ?? { startKey: '', ms: 0 });
  const unit = granularity === 'day' ? 'jour' : 'semaine';
  const label = (key: string): string => (granularity === 'day' ? formatDayKey(key) : `semaine du ${formatDayKey(key)}`);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  return (
    <section class="card" aria-labelledby="activity-title">
      <h2 id="activity-title">Activité {granularity === 'day' ? 'jour par jour' : 'semaine par semaine'}</h2>
      {max === 0 ? (
        <p class="muted">Aucune activité sur cette période.</p>
      ) : (
        <>
          <div class="activity" role="img" aria-label={`Temps passé en vocal par ${unit}. Pic : ${label(best.startKey)}, ${formatDuration(best.ms)}.`}>
            {buckets.map((bucket) => (
              <span
                key={bucket.startKey}
                class={bucket === best ? 'peak' : undefined}
                style={{ height: `${barPercent(bucket.ms, max)}%` }}
                title={`${label(bucket.startKey)} : ${formatDuration(bucket.ms)}`}
              />
            ))}
          </div>
          <div class="activity-axis" aria-hidden="true">
            <span>{first ? formatDayKey(first.startKey) : ''}</span>
            <span>{last ? formatDayKey(last.startKey) : ''}</span>
          </div>
          <p class="muted">
            Pic : {label(best.startKey)}, {formatDuration(best.ms)}.
          </p>
        </>
      )}
    </section>
  );
}

export function Together({ together, totalMs }: { together: MemberProfile['together']; totalMs: number }) {
  const withShare = shareOf(together.withOthersMs, totalMs);
  const max = maxOf(together.top.map((entry) => entry.ms));
  return (
    <section class="card" aria-labelledby="together-title">
      <h2 id="together-title">Avec qui</h2>
      {totalMs === 0 ? (
        <p class="muted">Aucune activité sur cette période.</p>
      ) : (
        <>
          <div class="split" aria-hidden="true">
            <span class="split-with" style={{ width: `${Math.round(withShare * 100)}%` }} />
          </div>
          <p>
            <strong class="mono">{formatDuration(together.withOthersMs)}</strong> avec d’autres personnes ({formatPercent(withShare)}),{' '}
            <strong class="mono">{formatDuration(together.aloneMs)}</strong> seul·e dans un salon.
          </p>
          {together.top.length === 0 ? (
            <p class="muted">Personne d’autre n’était dans ses salons.</p>
          ) : (
            <ul class="bars">
              {together.top.map((entry) => (
                <li key={entry.user.id}>
                  <span class="bar-name">
                    {entry.user.name}
                    <Handle user={entry.user} />
                  </span>
                  <span class="bar-track" aria-hidden="true">
                    <span class="bar-fill" style={{ width: `${barPercent(entry.ms, max)}%` }} />
                  </span>
                  <span class="mono bar-value">{formatDuration(entry.ms)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function VoiceStates({ states }: { states: NonNullable<MemberProfile['voiceStates']> }) {
  const rows = [
    { label: 'Micro coupé', ms: states.mutedMs },
    { label: 'Casque coupé', ms: states.deafMs },
    { label: 'Partage d’écran', ms: states.streamingMs },
    { label: 'Caméra', ms: states.videoMs },
  ];
  return (
    <section class="card" aria-labelledby="states-title">
      <h2 id="states-title">États en vocal</h2>
      {states.voiceMs === 0 ? (
        <p class="muted">Aucune activité sur cette période.</p>
      ) : (
        <>
          <ul class="bars">
            {rows.map((row) => (
              <li key={row.label}>
                <span class="bar-name">{row.label}</span>
                <span class="bar-track" aria-hidden="true">
                  <span class="bar-fill" style={{ width: `${Math.round(shareOf(row.ms, states.voiceMs) * 100)}%` }} />
                </span>
                <span class="mono bar-value">
                  {formatDuration(row.ms)} · {formatPercent(shareOf(row.ms, states.voiceMs))}
                </span>
              </li>
            ))}
          </ul>
          <p class="muted">Pourcentages du temps passé en vocal. « Micro coupé » inclut le casque coupé, pas un micro coupé par un modérateur.</p>
        </>
      )}
    </section>
  );
}

const PARTS: { key: keyof MemberProfile['habits']['partsOfDay']; label: string }[] = [
  { key: 'morningMs', label: 'Matin (6 h – 12 h)' },
  { key: 'afternoonMs', label: 'Après-midi (12 h – 18 h)' },
  { key: 'eveningMs', label: 'Soir (18 h – minuit)' },
  { key: 'nightMs', label: 'Nuit (minuit – 6 h)' },
];

export function Habits({ profile }: { profile: MemberProfile }) {
  const { habits, group } = profile;
  const memberTotal = Object.values(habits.partsOfDay).reduce((sum, value) => sum + value, 0);
  const groupTotal = Object.values(group.partsOfDay).reduce((sum, value) => sum + value, 0);
  return (
    <section class="card" aria-labelledby="habits-title">
      <h2 id="habits-title">Habitudes</h2>
      <ul class="rows">
        <li>
          <span>Arrive en moyenne vers</span>
          <span class="mono">{habits.avgArrivalMinute === null ? '—' : formatMinuteOfDay(habits.avgArrivalMinute)}</span>
        </li>
        <li>
          <span>Repart en moyenne vers</span>
          <span class="mono">{habits.avgDepartureMinute === null ? '—' : formatMinuteOfDay(habits.avgDepartureMinute)}</span>
        </li>
      </ul>
      {memberTotal > 0 && (
        <>
          <ul class="compare">
            {PARTS.map((part) => {
              const own = shareOf(habits.partsOfDay[part.key], memberTotal);
              const others = shareOf(group.partsOfDay[part.key], groupTotal);
              return (
                <li key={part.key}>
                  <span class="compare-label">{part.label}</span>
                  <span class="compare-bars" aria-hidden="true">
                    <span class="bar-track">
                      <span class="bar-fill" style={{ width: `${Math.round(own * 100)}%` }} />
                    </span>
                    <span class="bar-track">
                      <span class="bar-fill neutral" style={{ width: `${Math.round(others * 100)}%` }} />
                    </span>
                  </span>
                  <span class="mono bar-value">
                    {formatPercent(own)} <span class="muted">/ {formatPercent(others)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p class="muted">Part du temps par moment de la journée : ce membre, puis (en gris) la moyenne du groupe.</p>
        </>
      )}
    </section>
  );
}

export function GroupCompare({ profile }: { profile: MemberProfile }) {
  const { group, habits, voiceStates } = profile;
  const ownMuted = voiceStates ? shareOf(voiceStates.mutedMs, voiceStates.voiceMs) : null;
  const totalVsGroup = group.avgMemberTotalMs > 0 ? Math.round(((profile.totalMs - group.avgMemberTotalMs) / group.avgMemberTotalMs) * 100) : null;
  const sessionVsGroup = group.avgSessionMs > 0 && profile.sessions > 0 ? Math.round(((profile.avgSessionMs - group.avgSessionMs) / group.avgSessionMs) * 100) : null;

  return (
    <section class="card" aria-labelledby="group-title">
      <h2 id="group-title">Par rapport au groupe</h2>
      {profile.totalMs === 0 ? (
        <p class="muted">Aucune activité sur cette période.</p>
      ) : (
        <ul class="rows">
          <li>
            <span>Classement par temps passé</span>
            <span class="mono">{group.rank === null ? '—' : `${formatRank(group.rank)} sur ${group.of}`}</span>
          </li>
          <li>
            <span>
              Temps total <span class="muted">· moyenne du groupe {formatDuration(group.avgMemberTotalMs)}</span>
            </span>
            <span class="mono">{totalVsGroup === null ? '—' : formatSignedPercent(totalVsGroup)}</span>
          </li>
          <li>
            <span>
              Durée d’une session <span class="muted">· moyenne du groupe {formatDuration(group.avgSessionMs)}</span>
            </span>
            <span class="mono">{sessionVsGroup === null ? '—' : formatSignedPercent(sessionVsGroup)}</span>
          </li>
          {voiceStates !== null && (
            <li>
              <span>
                Micro coupé <span class="muted">· groupe {group.mutedShare === null ? '—' : formatPercent(group.mutedShare)}</span>
              </span>
              <span class="mono">{voiceStates.voiceMs > 0 && ownMuted !== null ? formatPercent(ownMuted) : '—'}</span>
            </li>
          )}
          <li>
            <span>Heure d’arrivée</span>
            <span>
              {habits.avgArrivalMinute !== null && group.avgArrivalMinute !== null
                ? describeTimeDifference(habits.avgArrivalMinute, group.avgArrivalMinute)
                : '—'}
            </span>
          </li>
        </ul>
      )}
    </section>
  );
}

export function RoomRoles({ profile }: { profile: MemberProfile }) {
  return (
    <section class="card" aria-labelledby="roles-title">
      <h2 id="roles-title">Salons et nuits</h2>
      <ul class="rows">
        <li>
          <span>
            Ouvre le salon <span class="muted">· première personne dans un salon vide</span>
          </span>
          <span class="mono">{profile.roomRoles.opened} fois</span>
        </li>
        <li>
          <span>
            Ferme le salon <span class="muted">· dernière personne à partir</span>
          </span>
          <span class="mono">{profile.roomRoles.closed} fois</span>
        </li>
        <li>
          <span>
            Nuits tardives <span class="muted">· sessions qui passent 3 h du matin</span>
          </span>
          <span class="mono">{profile.lateSessions}</span>
        </li>
        <li>
          <span>Meilleure série de jours</span>
          <span class="mono">{profile.streak.best} j</span>
        </li>
      </ul>
    </section>
  );
}
