import type { Period } from '@vocalog/shared';
import { fetchMemberProfile } from '../api.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Header } from '../components/Header.tsx';
import type { Controls } from '../components/Header.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Channels } from '../components/Lists.tsx';
import { ActivityChart, GroupCompare, Habits, MemberFigures, RoomRoles, Together, VoiceStates } from '../components/ProfileCards.tsx';
import { formatClock, visibleHandle } from '../format.ts';
import { useRemote } from '../useRemote.ts';

interface Props {
  guildId: string | null;
  userId: string;
  period: Period;
  /** The current `?serveur=...&periode=...`, used for the back link. */
  search: string;
  controls: Controls;
}

export function MemberView({ guildId, userId, period, search, controls }: Props) {
  const { data: profile, status, retry } = useRemote(guildId === null ? null : `${guildId}|${userId}|${period}`, () =>
    fetchMemberProfile(guildId!, userId, period),
  );

  return (
    <>
      <Header
        controls={controls}
        title={profile?.user.name ?? 'Membre'}
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

      {status === 'loading' && (
        <p class="notice" role="status">
          Chargement…
        </p>
      )}

      {profile !== null && (
        <div class="content">
          <MemberFigures profile={profile} />
          <div class="dashboard">
            <div class="col-7">
              <ActivityChart activity={profile.activity} />
            </div>
            <div class="col-5">
              <Heatmap heat={profile.heat} />
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
