import type { Summary } from '@vocalog/shared';
import { formatDateTime, formatDuration, formatHours } from '../format.ts';

export function KeyFigures({ summary }: { summary: Summary }) {
  const { totals, longestSession } = summary;
  const figures = [
    { label: 'Moyenne par jour', value: formatDuration(totals.avgPerDayMs), note: `sur ${totals.days} jour${totals.days > 1 ? 's' : ''}` },
    { label: 'Temps total', value: formatHours(totals.totalMs), note: `${totals.sessionCount} session${totals.sessionCount > 1 ? 's' : ''}` },
    {
      label: 'Plus longue session',
      value: longestSession ? formatDuration(longestSession.durationMs) : '—',
      note: longestSession ? `${longestSession.user.name}, ${formatDateTime(longestSession.startMs, summary.timeZone)}` : 'aucune',
    },
    { label: 'Série en cours', value: `${totals.streakDays} j`, note: 'jours de suite avec du vocal' },
  ];
  return (
    <dl class="figures" aria-label="Chiffres clés">
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
