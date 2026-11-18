import { useState } from 'preact/hooks';
import type { Summary } from '@vocalog/shared';
import { HOURS_FROM_SIX, busiestHour, formatDuration, maxOf } from '../format.ts';
import { memberPath } from '../router.ts';
import { Avatar } from './Avatar.tsx';
import { Handle } from './Handle.tsx';
import { Link } from './Link.tsx';

/**
 * One row per member: time, sessions and a 24-hour profile. A list rather than a table so it reflows on phones.
 * Only the most active members show at first (the list is sorted by time), so a long list does not leave an empty gap
 * under the shorter card beside it; a button reveals everyone.
 * `search` is the current `?serveur=...&periode=...` so a member page opens on the same server and period.
 */
const COLLAPSED_COUNT = 6;

export function MemberTable({ members, guildId, search, viewerId }: { members: Summary['members']; guildId: string; search: string; viewerId: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = members.length > COLLAPSED_COUNT + 1;
  const shown = collapsible && !expanded ? members.slice(0, COLLAPSED_COUNT) : members;
  return (
    <section class="card" id="membres" aria-labelledby="membres-title">
      <h2 id="membres-title">
        Membres <span class="count mono">{members.length}</span>
      </h2>
      <ul class="members">
        <li class="members-head" aria-hidden="true">
          <span />
          <span class="num">Temps</span>
          <span class="num">Sessions</span>
          <span>Profil horaire</span>
        </li>
        {shown.map((member) => {
          const peak = maxOf(member.hourMs);
          const busiest = busiestHour(member.hourMs);
          return (
            <li class="member" key={member.user.id}>
              <span class="member-name with-avatar">
                <Avatar user={member.user} guildId={guildId} size={32} />
                <span class="name-lines">
                  <Link to={memberPath(member.user.id, search)}>{member.user.name}</Link>
                  <span class="name-sub">
                    <Handle user={member.user} />
                    {member.user.id === viewerId && <span class="you">toi</span>}
                  </span>
                </span>
              </span>
              <span class="member-time mono">{formatDuration(member.totalMs)}</span>
              <span class="member-sessions mono">
                {member.sessions}
                <span class="unit"> session{member.sessions > 1 ? 's' : ''}</span>
              </span>
              <span class="spark" aria-hidden="true">
                {HOURS_FROM_SIX.map((hour) => {
                  const value = member.hourMs[hour] ?? 0;
                  return (
                    <span
                      key={hour}
                      class={value === peak && peak > 0 ? 'peak' : value === 0 ? 'none' : undefined}
                      style={{ height: `${peak > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / peak) * 100)) : 0}%` }}
                      data-tip={`${hour} h : ${formatDuration(value)}`}
                    />
                  );
                })}
              </span>
              <span class="sr-only">{busiest === null ? 'Aucune activité.' : `Heure la plus active : ${busiest} h.`}</span>
            </li>
          );
        })}
      </ul>
      {collapsible && (
        <button type="button" class="more" aria-expanded={expanded} aria-controls="membres" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Réduire la liste' : `Afficher les ${members.length} membres`}
        </button>
      )}
    </section>
  );
}
