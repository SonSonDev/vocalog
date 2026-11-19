import type { Period } from '@vocalog/shared';
import { fetchGuilds, fetchMe, logout } from './api.ts';
import type { Controls } from './components/Header.tsx';
import { buildSearch, navigate, parseRoute, readParams, useLocation } from './router.ts';
import { useSettings } from './settings.ts';
import { useRemote } from './useRemote.ts';
import { HomeView } from './views/HomeView.tsx';
import { LoginView } from './views/LoginView.tsx';
import { PageSkeleton } from './components/Skeleton.tsx';
import { TooltipLayer } from './components/Tooltip.tsx';
import { DayPageView } from './views/DayPageView.tsx';
import { MemberView } from './views/MemberView.tsx';
import { MonthPageView } from './views/MonthPageView.tsx';
import { WeekPageView } from './views/WeekPageView.tsx';
import { YearPageView } from './views/YearPageView.tsx';

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
  const settings = useSettings();
  const period: Period = params.period ?? settings.defaultPeriod;

  // First ask who is looking: with login on and nobody logged in, only the login screen is shown.
  const { data: me, status: meStatus, retry: retryMe } = useRemote('me', fetchMe);
  const needsLogin = me !== null && me.authMode === 'discord' && me.user === null;

  const { data: guilds, status, retry } = useRemote(me !== null && !needsLogin ? 'guilds' : null, fetchGuilds);
  const list = guilds ?? [];
  const wanted = params.guildId ?? loadGuildId();
  const guildId = list.find((guild) => guild.id === wanted)?.id ?? list[0]?.id ?? null;
  const search = buildSearch({ guildId, period });

  const controls: Controls = {
    guilds: list,
    guildId,
    period,
    viewer: me?.user ?? null,
    // Changing the period keeps the page; changing the server goes back to the summary (members differ per server).
    onPeriod: (value) => navigate(`${location.pathname}${buildSearch({ guildId, period: value })}`, true),
    onGuild: (id) => {
      saveGuildId(id);
      navigate(`/${buildSearch({ guildId: id, period })}`);
    },
    onLogout: () => {
      void logout().finally(() => window.location.assign('/'));
    },
  };

  return (
    <div class="app">
      <TooltipLayer />
      <main class="main">
        {meStatus === 'error' && (
          <div class="notice" role="alert">
            <p>Impossible de joindre le serveur. Vérifie qu’il est démarré.</p>
            <button type="button" onClick={retryMe}>
              Réessayer
            </button>
          </div>
        )}
        {/* Who is looking, then which servers, then the page: one continuous placeholder instead of three flashes of text. */}
        {(meStatus === 'loading' || (me !== null && !needsLogin && status === 'loading')) && <PageSkeleton variant={route.name} withHeader />}
        {needsLogin && <LoginView />}
        {me !== null && !needsLogin && status === 'error' && (
          <div class="notice" role="alert">
            <p>Impossible de charger la liste des serveurs. Vérifie que le serveur est démarré.</p>
            <button type="button" onClick={retry}>
              Réessayer
            </button>
          </div>
        )}
        {me !== null &&
          !needsLogin &&
          status === 'ready' &&
          (route.name === 'member' ? (
            <MemberView guildId={guildId} userId={route.userId} period={period} search={search} controls={controls} />
          ) : route.name === 'day' ? (
            <DayPageView guildId={guildId} dayKey={route.dayKey} period={period} search={search} controls={controls} />
          ) : route.name === 'week' ? (
            <WeekPageView guildId={guildId} startKey={route.startKey} period={period} search={search} controls={controls} />
          ) : route.name === 'month' ? (
            <MonthPageView guildId={guildId} monthKey={route.monthKey} period={period} search={search} controls={controls} />
          ) : route.name === 'year' ? (
            <YearPageView guildId={guildId} yearKey={route.yearKey} period={period} search={search} controls={controls} />
          ) : (
            <HomeView guildId={guildId} period={period} search={search} controls={controls} />
          ))}
      </main>
    </div>
  );
}
