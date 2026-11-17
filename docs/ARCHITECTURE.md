# Architecture — code map
Updated whenever a structural element is added, moved or removed. Principles live in CLAUDE.md. Built so far: `shared/`, `bot/`, `db/`. Planned: `server/`, `web/`.

## Layout
```
bot/      Discord collector. Depends on shared/. Writes voice_events and heartbeats. (built)
  src/index.ts      process entry: client, ready/reconcile, voiceStateUpdate, heartbeat, shutdown
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
server/   Fastify API, Discord OAuth2, session cookies, serves web/dist. Reads the database read-only. (planned)
web/      Vite + Preact app (French UI). Talks to server/ through the JSON API only. (planned)
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
- `guilds`, `channels`, `users` with names and a name-history table.
- `sessions` — derived, rebuildable.
- Migrations: numbered SQL files, each covered by a test. Backup: nightly `VACUUM INTO`.

## API surface
Planned, not final: `GET /api/me`, `GET /api/guilds`, `GET /api/guilds/:id/summary?period=`, `.../members`, `.../pairs`, `.../channels`, `GET /api/guilds/:id/members/:userId`.

## Conventions
- UTC epoch milliseconds everywhere in storage.
- Pure functions take plain data and return plain data.
- Configuration through environment variables only; fail loudly at startup if missing.
