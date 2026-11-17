import type { Summary } from '@vocalog/shared';
import { barPercent, formatDateTime, formatDuration, maxOf } from '../format.ts';

export function Records({ summary }: { summary: Summary }) {
  const { longestSession, peak } = summary;
  return (
    <section class="card" aria-labelledby="records-title">
      <h2 id="records-title">Records</h2>
      <ul class="rows">
        <li>
          <span>
            Plus longue session
            {longestSession && <span class="muted"> · {longestSession.user.name}, {longestSession.channel.name}</span>}
          </span>
          <span class="mono">{longestSession ? formatDuration(longestSession.durationMs) : '—'}</span>
        </li>
        <li>
          <span>
            Plus de monde en même temps
            {peak && <span class="muted"> · {formatDateTime(peak.atMs, summary.timeZone)}</span>}
          </span>
          <span class="mono">{peak ? peak.count : '—'}</span>
        </li>
      </ul>
    </section>
  );
}

export function Channels({ channels }: { channels: Summary['channels'] }) {
  const max = maxOf(channels.map((entry) => entry.totalMs));
  return (
    <section class="card" id="salons" aria-labelledby="channels-title">
      <h2 id="channels-title">Salons</h2>
      <ul class="bars">
        {channels.map((entry) => (
          <li key={entry.channel.id}>
            <span class="bar-name">{entry.channel.name}</span>
            <span class="bar-track" aria-hidden="true">
              <span class="bar-fill neutral" style={{ width: `${barPercent(entry.totalMs, max)}%` }} />
            </span>
            <span class="mono bar-value">{formatDuration(entry.totalMs)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
