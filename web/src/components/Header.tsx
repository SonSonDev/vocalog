import { PERIODS } from '@vocalog/shared';
import type { GuildInfo, Period } from '@vocalog/shared';
import type { Theme } from '../theme.ts';
import { Link } from './Link.tsx';

const PERIOD_LABELS: Record<Period, string> = { '7d': '7 j', '30d': '30 j', '1y': '1 an', all: 'Tout' };

/** The controls shared by every page: server, period and theme. */
export interface Controls {
  guilds: GuildInfo[];
  guildId: string | null;
  period: Period;
  theme: Theme;
  onGuild: (id: string) => void;
  onPeriod: (period: Period) => void;
  onTheme: () => void;
}

interface Props {
  controls: Controls;
  title: string;
  eyebrow: string;
  back?: { to: string; label: string };
}

export function Header({ controls, title, eyebrow, back }: Props) {
  const { guilds, guildId, period, theme, onGuild, onPeriod, onTheme } = controls;
  return (
    <header class="header">
      <div class="header-title">
        {back && (
          <Link to={back.to} class="back-link">
            ← {back.label}
          </Link>
        )}
        <p class="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div class="header-controls">
        <label class="select">
          <span class="sr-only">Serveur</span>
          <select value={guildId ?? ''} onChange={(event) => onGuild(event.currentTarget.value)} disabled={guilds.length === 0}>
            {guilds.map((guild) => (
              <option key={guild.id} value={guild.id}>
                {guild.name}
              </option>
            ))}
          </select>
        </label>
        <div class="segmented" role="group" aria-label="Période">
          {PERIODS.map((value) => (
            <button key={value} type="button" aria-pressed={value === period} onClick={() => onPeriod(value)}>
              {PERIOD_LABELS[value]}
            </button>
          ))}
        </div>
        <button type="button" class="theme-toggle" onClick={onTheme} aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}>
          {theme === 'dark' ? 'Clair' : 'Sombre'}
        </button>
      </div>
    </header>
  );
}
