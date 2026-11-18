import type { Period } from '@vocalog/shared';
import { summaryQuery } from '../queries.ts';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { ContributionGrid } from '../components/ContributionGrid.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import { KeyFigures } from '../components/KeyFigures.tsx';
import { PeriodStrips } from '../components/PeriodStrips.tsx';
import { Channels, Records } from '../components/Lists.tsx';
import { MemberTable } from '../components/MemberTable.tsx';
import { formatClock, formatDuration } from '../format.ts';
import { buildMemberGrid } from '../yearGrid.ts';
import { useRemote } from '../useRemote.ts';

interface Props {
  guildId: string | null;
  period: Period;
  search: string;
  controls: Controls;
}

export function HomeView({ guildId, period, search, controls }: Props) {
  const query = guildId === null ? null : summaryQuery(guildId, period);
  // Changing the period keeps the page in place, dimmed, until the new figures arrive (same scope).
  const { data: summary, status, stale, retry } = useRemote(query?.key ?? null, () => query!.load(), guildId === null ? null : `home|${guildId}`);

  return (
    <>
      <Header controls={controls} title="Vocalog" />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger les statistiques. Vérifie que le serveur est démarré.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="home" />}

      {summary !== null && (
        <div class={stale ? 'content is-loading' : 'content'} aria-busy={stale}>
          <KeyFigures summary={summary} />
          {summary.members.length > 0 ? (
            <div class="dashboard">
              <div class="col-7 tall">
                <MemberTable members={summary.members} guildId={summary.guild.id} period={period} search={search} viewerId={controls.viewer?.id ?? null} />
              </div>
              <div class="col-5">
                <Heatmap heat={summary.heat} />
              </div>
              <div class="col-5">
                <Records summary={summary} />
              </div>
              <div class="col-12">
                <section class="card" aria-labelledby="year-title">
                  <h2 id="year-title">
                    12 derniers mois <span class="count mono">{formatDuration(summary.yearGrid.totals.reduce((sum, value) => sum + value, 0))}</span>
                  </h2>
                  <ContributionGrid grid={buildMemberGrid(summary.yearGrid)} label="Voix du groupe sur les 12 derniers mois, une case par jour." scrollToEnd resetKey={summary.guild.id} />
                </section>
              </div>
              {summary.days.length > 0 && (
                <div class="col-12">
                  <PeriodStrips summary={summary} search={search} />
                </div>
              )}
              <div class="col-12">
                <Channels channels={summary.channels} />
              </div>
            </div>
          ) : (
            <p class="notice" role="status">
              Pas encore de données pour cette période.
            </p>
          )}
          <p class="footnote">
            Fuseau horaire : {summary.timeZone} · mis à jour à {formatClock(summary.generatedAtMs, summary.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}
