import type { Summary } from '@vocalog/shared';
import { busiestHour, formatDuration, maxOf } from '../format.ts';
import { memberPath } from '../router.ts';
import { Handle } from './Handle.tsx';
import { Link } from './Link.tsx';

/**
 * One row per member: time, sessions and a 24-hour profile. A list rather than a table so it reflows on phones.
 * `search` is the current `?serveur=...&periode=...` so a member page opens on the same server and period.
 */
export function MemberTable({ members, search, viewerId }: { members: Summary['members']; search: string; viewerId: string | null }) {
  return (
    <section class="card" id="membres" aria-labelledby="membres-title">
      <h2 id="membres-title">Membres</h2>
      <ul class="members">
        <li class="members-head" aria-hidden="true">
          <span>Membre</span>
          <span class="num">Temps</span>
          <span class="num">Sessions</span>
          <span>Profil horaire</span>
        </li>
        {members.map((member) => {
          const peak = maxOf(member.hourMs);
          const busiest = busiestHour(member.hourMs);
          return (
            <li class="member" key={member.user.id}>
              <span class="member-name">
                <Link to={memberPath(member.user.id, search)}>{member.user.name}</Link>
                <Handle user={member.user} />
                {member.user.id === viewerId && <span class="you"> · toi</span>}
              </span>
              <span class="member-time mono">{formatDuration(member.totalMs)}</span>
              <span class="member-sessions mono">
                {member.sessions}
                <span class="unit"> session{member.sessions > 1 ? 's' : ''}</span>
              </span>
              <span class="spark" aria-hidden="true">
                {member.hourMs.map((value, hour) => (
                  <span
                    key={hour}
                    class={value === peak && peak > 0 ? 'peak' : undefined}
                    style={{ height: `${peak > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / peak) * 100)) : 0}%` }}
                    title={`${hour} h`}
                  />
                ))}
              </span>
              <span class="sr-only">{busiest === null ? 'Aucune activité.' : `Heure la plus active : ${busiest} h.`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
