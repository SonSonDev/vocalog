import type { Period } from '@vocalog/shared';
import { summaryQuery } from '../queries.ts';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import { KeyFigures } from '../components/KeyFigures.tsx';
import { DayStrips } from '../components/DayStrips.tsx';
import { Channels, Records } from '../components/Lists.tsx';
import { MemberTable } from '../components/MemberTable.tsx';
import { formatClock } from '../format.ts';
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
              <div class="col-7">
                <MemberTable members={summary.members} guildId={summary.guild.id} period={period} search={search} viewerId={controls.viewer?.id ?? null} />
              </div>
              <div class="col-5">
                <Heatmap heat={summary.heat} />
              </div>
              {summary.days.length > 0 && (
                <div class="col-12">
                  <DayStrips days={summary.days} guildId={summary.guild.id} search={search} />
                </div>
              )}
              <div class="col-6">
                <Channels channels={summary.channels} />
              </div>
              <div class="col-6">
                <Records summary={summary} />
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
