# CLAUDE.md — Vocalog (TypeScript, Node, Discord bot + web dashboard)

## Context
- Developer: experience level not stated. Explain new platform concepts (Discord gateway, OAuth2, SQLite pragmas) in 1–2 lines.
- Talk to the developer in French. Code, identifiers, comments, docs, commits in English.
- Target: a Raspberry Pi managed by raspi-manager (SSH + systemd + Cloudflare Tunnel). Test device: the developer's Windows PC.
- Tier: T1 personal tool (see docs/DECISIONS.md).

## Stack (checked 2026-11-17 on the npm registry — re-check online before upgrading or adding anything)
- Node 24 LTS (active LTS until 2028-04-30), TypeScript 7.0.2.
- discord.js 14.28.1 (Apache-2.0), intent `GuildVoiceStates` only.
- better-sqlite3 13.2.0 (MIT, Node >= 22). Fallback: `node:sqlite` (release candidate since Node 24.15).
- Fastify 5.12.8 (API, sessions, hand-written Discord OAuth2, scopes `identify guilds`).
- Vite 8.3.8 + Preact 11.2.0 for the web app. No chart library: heatmap, bars and dials are CSS.
- Vitest 5.1.0 for tests.
- **Library policy**: anything not listed needs approval. Before adding: latest stable version, maintenance,
  publisher, licence; prefer official/first-party; say what was added and why; log it in docs/DECISIONS.md.
  Linter/formatter are not chosen yet: pick and log them in the first slice.
- **Version freshness**: at the start of a session touching dependencies and at each milestone, compare against
  current stable releases and report what is behind. Never claim "verified" without checking online that session.

## Project documentation
- @docs/BRIEF.md — goal, ambition, scale, constraints (the why)
- @docs/SPEC.md — features, behaviour, scope, status
- `docs/ARCHITECTURE.md` — code map and data flows (read when touching structure)
- `docs/DECISIONS.md` — decision log, newest first
- `docs/QUESTIONS.md` — doubtful behaviours awaiting an answer
- `docs/DESIGN.md` — visual direction, tokens, UX evidence (read when touching UI; use the `design-ui` skill in apply mode)
- **Docs are always in sync with the code, without being asked, in the same change:**
  behaviour → SPEC · structure → ARCHITECTURE · any technical/product choice (even in discussion) → DECISIONS.
  End each task by stating which docs were updated (or none). If doc and code disagree, say so.
- Context budget: only BRIEF and SPEC are `@`-imported; each doc < ~400 lines; archive old decisions in `docs/archive/`.

## Architecture rules
- Four packages in one repo: `bot/` (collector), `server/` (API + OAuth), `web/` (Preact app), `shared/` (types and pure calculations).
- `bot/` depends only on `shared/`. `server/` reads the database read-only. `web/` talks to `server/` through the JSON API only.
- **The event journal is the source of truth.** `voice_events` is append-only: never update or delete rows (except a user's own deletion request, see SPEC). Sessions and aggregates are derived and rebuildable.
- **Never store message text or any message data.** The bot requests no message intent.
- Pure calculations (sessions, time together, aggregates) live in `shared/`, take plain data, and have unit tests.
- Time is stored as UTC epoch milliseconds. Convert to a timezone only at the display layer.
- Errors: the bot must never crash on one bad event; log it and continue. Fail loudly at startup on missing configuration.
- Files stay under ~400 lines. Prefer deleting code to commenting it out. Comments explain why.

## UX & design rules
- Follow docs/DESIGN.md (direction "Rail and table", light and dark themes, one accent colour, strict grid).
- Always design the four states: loading, empty, error, content. Touch targets >= 44 px, AA contrast including text on the accent, visible focus, full keyboard use, `prefers-reduced-motion`.
- UI text in French. Code and keys in English.

## Quality gates (a task is not done until these pass; say which were run)
- `npm run typecheck`, `npm test`, `npm run build`, plus lint once chosen.
- Any change to session or time-together logic needs a unit test; any schema change needs a migration test.
- UI changes: capture at 390, 768 and 1280 px, light and dark (design-ui apply rules).

## Data safety & security
- No secrets in git: bot token, OAuth client secret and session secret come from environment variables; keep `.env` ignored; commit `.env.example` with placeholders only.
- Database file is ignored by git. Nightly backup with `VACUUM INTO` is part of the deployment.
- Collected personal data: Discord user IDs and presence times only. Friends are informed; an opt-out and deletion path must exist.
- Never put private information (personal paths, names, e-mails, hostnames, IPs, domains) in docs, code, comments, tests or commits: use placeholders (`~/apps/<app>`, `example.com`). Use the `privacy-audit` skill before a first push.

## Safety (environment)
- Never point a development bot at the production database file. Development uses its own database and its own test server.
- Confirm before any destructive action on data (delete, purge, schema reset).

## Working agreement
- Ask when it is the developer's call (product behaviour, scope, new dependency, tier change); decide and say so
  when there is a conventional answer. Give a recommendation, not a survey. Questions go through `AskUserQuestion`, one at a time, recommended option first.
- Small reviewable steps; one logical change per commit, imperative English message; commit only when asked. No Claude attribution in commit messages or PR descriptions.
- Check whether the platform/an approved library already does it before building.
- Milestone check (each release or ~20 commits): stale deps, dead code, files > 400 lines, docs size, untested
  logic, TODOs — report briefly, don't refactor unasked (`/project-checkpoint`).

## Commands
- `npm test` — Vitest, all packages. `npm run typecheck` — `tsc --noEmit`.
- Bot: `node --env-file=.env bot/src/index.ts`. `DB_PATH` is required and absolute (the folder is created if missing). Copy `.env.example` to `.env` for local values; never read or print the token. Deployment steps are in README.md.
- Build the web app: `npm run build` (output in `web/dist`).
- Demo data (fictional members, never the real database): `node scripts/seed-demo.ts <absolute path of a NEW file>`; it refuses to overwrite.
- Local dashboard: `DB_PATH=<db> WEB_DIR=<abs path of web/dist> PORT=3111 INSECURE_NO_AUTH=1 node server/src/index.ts`, then open `http://127.0.0.1:3111`. For live reload run `npm run dev -w web` with `API_PORT=3111` (Vite proxies `/api`). The server opens the database read-only.
- **Never set `INSECURE_NO_AUTH=1` on the Pi or anywhere a tunnel can reach**: Discord login is not built yet.
