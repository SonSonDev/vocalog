import type { Period } from '@vocalog/shared';
import { fetchSummary } from '../api.ts';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
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
  const { data: summary, status, retry } = useRemote(guildId === null ? null : `${guildId}|${period}`, () => fetchSummary(guildId!, period));

  return (
    <>
      <Header controls={controls} title="Qui était en vocal" eyebrow="Vocalog" />

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

      {status === 'loading' && (
        <p class="notice" role="status">
          Chargement…
        </p>
      )}

      {summary !== null && (
        <div class="content">
          <KeyFigures summary={summary} />
          {summary.members.length > 0 ? (
            <div class="dashboard">
              <div class="col-7">
                <MemberTable members={summary.members} guildId={summary.guild.id} search={search} viewerId={controls.viewer?.id ?? null} />
              </div>
              <div class="col-5">
                <Heatmap heat={summary.heat} />
              </div>
              {summary.days.length > 0 && (
                <div class="col-12">
                  <DayStrips days={summary.days} search={search} />
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
