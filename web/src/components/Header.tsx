import { PERIODS } from '@vocalog/shared';
import type { GuildInfo, NamedRef, Period } from '@vocalog/shared';
import type { ComponentChildren } from 'preact';
import { visibleHandle } from '../format.ts';
import { Avatar } from './Avatar.tsx';
import { GuildIcon } from './GuildIcon.tsx';
import { Link } from './Link.tsx';
import { SettingsMenu } from './SettingsMenu.tsx';

const PERIOD_LABELS: Record<Period, string> = { '7d': '7 j', '30d': '30 j', '1y': '1 an', all: 'Tout' };

/** The controls shared by every page: server, period and who is looking. The theme and the rest are in the settings menu. */
export interface Controls {
  guilds: GuildInfo[];
  guildId: string | null;
  period: Period;
  onGuild: (id: string) => void;
  onPeriod: (period: Period) => void;
  /** The logged-in person, or null when login is off (local development). */
  viewer: NamedRef | null;
  onLogout: () => void;
}

interface Props {
  controls: Controls;
  title: ComponentChildren;
  /** A small @username shown after the title (member pages). */
  handle?: string | null;
  /** A picture shown before the title (member pages). */
  avatar?: ComponentChildren;
  back?: { to: string; label: string };
  /** False on a page the period does not change (a single day): the selector would do nothing there. */
  showPeriod?: boolean;
}

/**
 * Two rows. Top bar: where you are (the server, with its picture) on the left, who you are (picture, name, @username,
 * log out) and the settings menu on the right. Title row: the page title and, when it applies, its period.
 */
export function Header({ controls, title, handle, avatar, back, showPeriod = true }: Props) {
  const { guilds, guildId, period, onGuild, onPeriod, viewer, onLogout } = controls;
  const guild = guilds.find((entry) => entry.id === guildId) ?? null;
  const viewerHandle = viewer ? visibleHandle(viewer.name, viewer.handle) : null;

  return (
    <header class="header">
      <div class="topbar">
        <label class="server-picker">
          <span class="sr-only">Serveur</span>
          <GuildIcon guild={guild} size={36} />
          <select value={guildId ?? ''} onChange={(event) => onGuild(event.currentTarget.value)} disabled={guilds.length === 0}>
            {guilds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <div class="topbar-end">
          {viewer && (
            <div class="viewer">
              <Avatar user={viewer} guildId={guildId} size={32} />
              <span class="viewer-name">
                {viewer.name}
                {viewerHandle && <span class="handle">{viewerHandle}</span>}
              </span>
              <button type="button" class="topbar-button" onClick={onLogout}>
                Déconnexion
              </button>
            </div>
          )}
<SettingsMenu />
        </div>
      </div>

      <div class="titlebar">
        <div class="header-title">
          {back && (
            <Link to={back.to} class="back-link">
              ← {back.label}
            </Link>
          )}
          <h1 class={avatar ? 'with-avatar' : undefined}>
            {avatar}
            <span>
              {title}
              {handle && <span class="handle">{handle}</span>}
            </span>
          </h1>
        </div>
        {showPeriod && (
          <div class="segmented" role="group" aria-label="Période">
            {PERIODS.map((value) => (
              <button key={value} type="button" aria-pressed={value === period} onClick={() => onPeriod(value)}>
                {PERIOD_LABELS[value]}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
