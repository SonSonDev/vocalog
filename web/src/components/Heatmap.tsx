import { WEEKDAYS_LONG, WEEKDAYS_SHORT, busiestCell, formatDuration, maxOf } from '../format.ts';

const HOUR_LABELS = [0, 6, 12, 18, 23];

export function Heatmap({ heat }: { heat: number[][] }) {
  const max = maxOf(heat.map((row) => maxOf(row)));
  const best = busiestCell(heat);
  const summary = best ? `Le plus actif : ${WEEKDAYS_LONG[best.weekday]} vers ${best.hour} h.` : 'Pas encore d’activité sur cette période.';

  return (
    <section class="card" aria-labelledby="heat-title">
      <h2 id="heat-title">Heures de présence</h2>
      <div class="table-scroll">
        <div class="heat" role="img" aria-label={`Carte de chaleur de la présence par jour et par heure. ${summary}`}>
          {heat.map((row, weekday) => (
            <div class="heat-row" key={weekday}>
              <span class="heat-day">{WEEKDAYS_SHORT[weekday]}</span>
              <div class="heat-cells">
                {row.map((value, hour) => (
                  <span
                    key={hour}
                    class="heat-cell"
                    style={{ '--v': max > 0 ? (value / max).toFixed(3) : '0' }}
                    title={`${WEEKDAYS_LONG[weekday]} ${hour} h : ${formatDuration(value)}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div class="heat-row">
            <span class="heat-day" />
            <div class="heat-axis" aria-hidden="true">
              {HOUR_LABELS.map((hour) => (
                <span key={hour}>{hour} h</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p class="muted">{summary}</p>
    </section>
  );
}
