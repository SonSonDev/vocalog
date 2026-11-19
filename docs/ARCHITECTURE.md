# Architecture — code map
Updated whenever a structural element is added, moved or removed. Principles live in CLAUDE.md. Built so far: `shared/`, `bot/`, `db/`. Planned: `server/`, `web/`.

## Layout
```
bot/      Discord collector. Depends on shared/. Writes voice_events and heartbeats. (built)
  src/index.ts      process entry: client, ready/reconcile, voiceStateUpdate, heartbeat, shutdown
  src/liveness.ts   shouldWriteHeartbeat() and the loss tracker: since when events may have been missed (pure)
  src/config.ts     reads and validates DISCORD_TOKEN, ALLOWED_GUILD_IDS, DB_PATH (pure, fail-fast)
  src/allowlist.ts  parses ALLOWED_GUILD_IDS and filters servers (pure)
  src/events.ts     discord.js VoiceState -> VoiceStateLike -> journal event (pure)
  src/collector.ts  startup reconciliation wired to the database
  src/store.ts      SQL read/write helpers (events, heartbeats, names)
  src/db.ts         opens SQLite (WAL) and applies migrations
shared/   Types and pure calculations. No I/O. (built)
  src/types.ts      VoiceEvent, Session, LiveVoiceState, VoiceFlag
  src/sessions.ts   deriveSessions, durationMs, totalByUser
  src/together.ts   overlapMs, pairKey, togetherByPair
  src/reconcile.ts  planReconcile (restart synthetic events)
  src/aggregate.ts  aggregate(): totals, members, hourly profile, heat map, pairs, channels, records, streak (pure, time-zone aware)
  src/api.ts        types of the JSON API (Summary, MemberProfile, Period, GuildInfo), used by server and web
  src/flags.ts      flagTimesByUser(): time muted, deafened, sharing screen, on camera, from the journal states; flagIntervalsByUser(): the same states as stretches of time (day timeline layers)
  src/profile.ts    buildMemberStats(): everything on a member page (habits, activity buckets, room roles, group comparison)
server/   Fastify API. Opens the bot's database READ-ONLY. Serves web/dist when WEB_DIR is set. (built; Discord login not built)
  src/index.ts      process entry: config, read-only database, listen on 127.0.0.1
  src/app.ts        routes: GET /api/guilds, GET /api/guilds/:guildId/summary, GET /api/guilds/:guildId/members/:userId (period=7d|30d|1y|all); static fallback
  src/summary.ts    builds the Summary: sessions -> aggregate -> names
  src/profile.ts    builds a MemberProfile: events -> sessions + flag times -> buildMemberStats -> names
  src/queries.ts    read-only SQL (guilds, names, events of one server)
  src/period.ts     period windows; src/static.ts safe static file serving with SPA fallback
  src/config.ts     env validation (DB_PATH, PORT, STATS_TIME_ZONE, WEB_DIR, the four Discord login variables, or INSECURE_NO_AUTH, never both)
  src/auth.ts       login routes (/auth/login, /auth/callback, /auth/logout), the viewer, which servers a request may see
  src/oauth.ts      Discord authorize URL and the code exchange; the access token never leaves this function
  src/session.ts    signed session cookie (HMAC-SHA256, constant-time check), cookie parsing and serialising
web/      Vite + Preact app, French UI, design "Rail and table" (built; not yet checked in a browser)
  src/App.tsx       shell: theme, server list, controls shared by the pages, route choice
  src/router.ts     tiny History-API router, no dependency: `/` and `/membres/<id>`, state in `?serveur=&periode=`
  src/useRemote.ts  loads data for a key; never shows the previous key's data; retry
  src/views/        HomeView (summary), MemberView (profile)
  src/components/   Header (with back link), Link, KeyFigures, MemberTable (list, links to profiles), Heatmap, Lists (Records, Channels), ProfileCards (member figures, activity, together, voice states, habits, group, rooms)
  src/charts/       hand-written SVG (`TimelineTrack` also draws the state overlays) for time bars: layout.ts (pure `layoutSpans`, tested), useWidth.ts (ResizeObserver), Timeline.tsx (`TimelineTrack`, used by the day and week pages)
  src/format.ts     durations, dates, bars (pure, tested); src/settings.ts + accents.ts + components/SettingsMenu.tsx: client settings (theme, accent, density, motion, default period, time zone, first weekday) in browser storage, applied as data attributes and CSS variables
  src/styles.css    tokens from docs/DESIGN.md; system fonts
scripts/  seed-demo.ts: demo database with fictional members (refuses to overwrite an existing file)
db/       Numbered SQL migrations (001_init.sql). (built)
docs/     BRIEF, SPEC, ARCHITECTURE, DECISIONS, QUESTIONS, DESIGN.
```
TypeScript is run directly by Node (native type stripping, no build step for `bot/` and `server/`); `tsc --noEmit` is the typecheck. Tests (Vitest) sit next to the code as `*.test.ts`.

## Components
- **Collector (bot)**: listens to `voiceStateUpdate` with intent `GuildVoiceStates`; maps old and new state to events; writes them in one transaction; heartbeat every minute; reconciliation on start.
- **Derivation (shared)**: builds sessions from events; computes overlaps for time together; produces aggregates by day, month, hour, channel, pair. Pure functions with unit tests.
- **API (server)**: login, `/me`, `/guilds`, per-guild summary, members, pairs, channels, profile. Aggregates cached in memory and invalidated on new events.
- **Web**: pages matching the design direction; theme switch; period and server selectors.

## Data flow
Discord gateway → bot → `voice_events` (append-only) → derivation (shared) → server aggregates → JSON API → web.
Heartbeats feed reconciliation only.

## Data model (sketch)
- `voice_events(id, guild_id, user_id, channel_id, kind, flags, at_ms, source, raw_json)` — append-only.
- `heartbeats(at_ms)`.
- `guilds` (name, `afk_channel_id`, `icon` hash added by migration 004), `channels` (name, `type` 2 voice / 13 stage), `users` (global username, `avatar` hash added by migration 003), `members` (name shown on one server, `is_bot`), `name_history` (every name seen, by kind). Added by migration 002, which is additive so the previous bot version keeps working on it.
- `sessions` — derived, rebuildable.
- Migrations: numbered SQL files, each covered by a test. Backup: nightly `VACUUM INTO`.

## API surface
Built: `GET /api/guilds`, `GET /api/guilds/:guildId/summary?period=7d|30d|1y|all` (default 30d; 400 on a bad period, 404 on an unknown server) and `GET /api/guilds/:guildId/members/:userId?period=` (404 for a member with no event on that server). Also `GET /api/me` (open: `{ authMode, user }`), `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`. With Discord login on, every `/api/guilds...` route needs a valid session (401 otherwise) and only serves servers listed in the session; the member route removes the voice-state fields when the viewer is not that member (`restricted: true`). Answers under `/api/` and `/auth/` are `no-store`; every response carries `nosniff`, `X-Frame-Options: DENY` and `same-origin` referrer policy. Without login the server refuses to start unless `INSECURE_NO_AUTH=1`, and then nothing is restricted.
Period windows never start before the first recorded event of the server, so a young journal is not averaged over unrecorded days.
`GET /api/guilds/:guildId/days/:dayKey` (one day in detail: 400 for a bad date, 404 for a future day) and `GET /api/guilds/:guildId/avatars/:userId` (the picture, fetched by `server/src/image.ts` from Discord's image host with an address built from two checked database values, redirects refused, PNG only, at most 200 kB, kept in memory; 404 when there is none; the browser may keep it). `GET /api/guilds/:guildId/icon` does the same for a server's icon (the hash comes from `guilds.icon`), and `/api/me` carries the logged-in person's name, `@username` (from the login) and avatar hash (if the bot has seen them). `GET /api/guilds/:guildId/weeks/:mondayKey` (a Monday; 400 otherwise, 404 for a week in the future) and `GET /api/guilds/:guildId/months/:monthKey` (`YYYY-MM`) give one week or one month in detail, and `GET /api/guilds/:guildId/years/:yearKey` (`YYYY`) one year as twelve month calendars. The summary also carries `weeks` and `months` (strips, at most 12 each) and `years` (at most 6) next to `days` (the strips). `server/src/names.ts` resolves ids to names and avatar hashes for every route; the avatar column is optional until the bot has migrated. Day and strip calculations are pure, in `shared/src/timeline.ts`; weeks and months in `shared/src/calendar.ts`.
Answers are kept in a small in-memory cache (`server/src/cache.ts`, 200 entries) keyed by route, server, member and period; an entry is reused while the last `voice_events` id and the current minute are unchanged. A server error is logged by route (never the query) and answered with a generic 500. `scripts/backup.ts` makes `VACUUM INTO` copies and prunes old ones.

## Web data layer
- View settings that change the figures travel with each request as `?tz=<IANA zone>` and `?ws=sunday` (nothing for the defaults); `queries.ts` puts both in every cache key, so another zone or week start never shows a cached answer. The server validates them in `server/src/viewOptions.ts` (unknown values answer 400) and adds them to its own cache keys. `shared/` takes the zone and a `WeekStart` as plain arguments.
`web/src/remoteCache.ts` keeps API answers in memory (60 entries, fresh for 30 s, one shared request per key); `web/src/useRemote.ts` shows the answer for the current key, else the last answer of the same scope (marked stale and dimmed), else a skeleton (`web/src/components/Skeleton.tsx`); `web/src/queries.ts` builds the key and loader of every request so a prefetch (`Link` `onPrefetch`, neighbouring days) fills exactly what the page reads. `web/src/motion.css` holds the placeholders and every animation. `web/src/yearGrid.ts` lays days out as weeks and weekdays for the contribution-style grid (a calendar year or a member's last 53 weeks; pure, tested) and `web/src/components/ContributionGrid.tsx` draws it. The member profile carries `yearGrid` (`startKey`, one total per day, `elapsedDays`), computed from the member's own sessions by `buildMemberYear`.

## Conventions
- UTC epoch milliseconds everywhere in storage.
- Pure functions take plain data and return plain data.
- Configuration through environment variables only; fail loudly at startup if missing.
