import type { Period } from '@vocalog/shared';
import { useEffect, useState } from 'preact/hooks';
import { fetchGuilds } from './api.ts';
import type { Controls } from './components/Header.tsx';
import { buildSearch, navigate, parseRoute, readParams, useLocation } from './router.ts';
import { applyTheme, loadTheme } from './theme.ts';
import type { Theme } from './theme.ts';
import { useRemote } from './useRemote.ts';
import { HomeView } from './views/HomeView.tsx';
import { MemberView } from './views/MemberView.tsx';

const GUILD_KEY = 'vocalog-guild';

function loadGuildId(): string | null {
  try {
    return window.localStorage.getItem(GUILD_KEY);
  } catch {
    return null;
  }
}

function saveGuildId(id: string): void {
  try {
    window.localStorage.setItem(GUILD_KEY, id);
  } catch {
    // ignore: the choice just is not remembered
  }
}

export function App() {
  const location = useLocation();
  const route = parseRoute(location.pathname);
  const params = readParams(location.search);
  const period: Period = params.period ?? '30d';

  const [theme, setTheme] = useState<Theme>(loadTheme);
  useEffect(() => applyTheme(theme), [theme]);

  const { data: guilds, status, retry } = useRemote('guilds', fetchGuilds);
  const list = guilds ?? [];
  const wanted = params.guildId ?? loadGuildId();
  const guildId = list.find((guild) => guild.id === wanted)?.id ?? list[0]?.id ?? null;
  const search = buildSearch({ guildId, period });

  const controls: Controls = {
    guilds: list,
    guildId,
    period,
    theme,
    // Changing the period keeps the page; changing the server goes back to the summary (members differ per server).
    onPeriod: (value) => navigate(`${location.pathname}${buildSearch({ guildId, period: value })}`, true),
    onGuild: (id) => {
      saveGuildId(id);
      navigate(`/${buildSearch({ guildId: id, period })}`);
    },
    onTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };

  return (
    <div class="app">
      <main class="main">
        {status === 'error' && (
          <div class="notice" role="alert">
            <p>Impossible de charger la liste des serveurs. Vérifie que le serveur est démarré.</p>
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
        {status === 'ready' &&
          (route.name === 'member' ? (
            <MemberView guildId={guildId} userId={route.userId} period={period} search={search} controls={controls} />
          ) : (
            <HomeView guildId={guildId} period={period} search={search} controls={controls} />
          ))}
      </main>
    </div>
  );
}
