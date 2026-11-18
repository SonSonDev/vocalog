import type { Period } from '@vocalog/shared';
import { memberQuery } from '../queries.ts';
import { Avatar } from '../components/Avatar.tsx';
import { ContributionGrid } from '../components/ContributionGrid.tsx';
import { Header } from '../components/Header.tsx';
import { PageSkeleton } from '../components/Skeleton.tsx';
import type { Controls } from '../components/Header.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Channels } from '../components/Lists.tsx';
import { ActivityChart, GroupCompare, Habits, MemberFigures, RoomRoles, Together, VoiceStates } from '../components/ProfileCards.tsx';
import { formatClock, formatDuration, visibleHandle } from '../format.ts';
import { useRemote } from '../useRemote.ts';
import { buildMemberGrid } from '../yearGrid.ts';

interface Props {
  guildId: string | null;
  userId: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, used for the back link. */
  search: string;
  controls: Controls;
}

export function MemberView({ guildId, userId, period, search, controls }: Props) {
  const query = guildId === null ? null : memberQuery(guildId, userId, period);
  // Changing the period keeps this member's page in place, dimmed; another member never shows under this title.
  const { data: profile, status, stale, retry } = useRemote(query?.key ?? null, () => query!.load(), guildId === null ? null : `member|${guildId}|${userId}`);

  return (
    <>
      <Header
        controls={controls}
        title={profile ? profile.user.name : <span class="sk sk-h1" role="status" aria-label="Chargement" />}
        handle={profile ? visibleHandle(profile.user.name, profile.user.handle) : null}
        avatar={profile && guildId ? <Avatar user={profile.user} guildId={guildId} size={44} /> : null}
        back={{ to: `/${search}`, label: 'Tous les membres' }}
      />

      {guildId === null && (
        <p class="notice" role="status">
          Aucun serveur enregistré pour le moment.
        </p>
      )}

      {status === 'error' && (
        <div class="notice" role="alert">
          <p>Impossible de charger ce membre. Il n’a peut-être pas d’activité sur ce serveur.</p>
          <button type="button" onClick={retry}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'loading' && <PageSkeleton variant="member" />}

      {profile !== null && (
        <div class={stale ? 'content is-loading' : 'content'} aria-busy={stale}>
          <MemberFigures profile={profile} />
          <div class="dashboard">
            <div class="col-7">
              <ActivityChart activity={profile.activity} />
            </div>
            <div class="col-5">
              <Heatmap heat={profile.heat} />
            </div>
            <div class="col-12">
              <section class="card" aria-labelledby="year-title">
                <h2 id="year-title">
                  12 derniers mois <span class="count mono">{formatDuration(profile.yearGrid.totals.reduce((sum, value) => sum + value, 0))}</span>
                </h2>
                <ContributionGrid grid={buildMemberGrid(profile.yearGrid)} label="Voix du membre sur les 12 derniers mois, une case par jour." scrollToEnd resetKey={`${guildId}|${userId}`} />
              </section>
            </div>
            <div class="col-6">
              <Together together={profile.together} totalMs={profile.totalMs} guildId={guildId!} />
            </div>
            <div class="col-6">
              <VoiceStates states={profile.voiceStates} />
            </div>
            <div class="col-6">
              <Habits profile={profile} />
            </div>
            <div class="col-6">
              <GroupCompare profile={profile} />
            </div>
            <div class="col-6">
              <Channels channels={profile.channels} />
            </div>
            <div class="col-6">
              <RoomRoles profile={profile} />
            </div>
          </div>
          <p class="footnote">
            Fuseau horaire : {profile.timeZone} · mis à jour à {formatClock(profile.generatedAtMs, profile.timeZone)}
          </p>
        </div>
      )}
    </>
  );
}
