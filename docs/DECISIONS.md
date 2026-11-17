# Decision log
One entry per decision, newest first. A decision is only changed by a new entry that supersedes it.
Not logged: visual tweaks, tuning values, reverted trials.

## 2026-11-17 — Project name: Vocalog
- Decision: the application is called Vocalog ("vocal" + "log", the append-only voice journal). Packages are `@vocalog/shared` and `@vocalog/bot`; the root package is `vocalog`; README and CLAUDE.md titles updated; the example data path is `.../data/vocalog/`.
- Why: chosen by the developer among variants of "Vocalstat". Checked on 2026-11-17: `vocalog` is not published on npm (registry returned 404), and a web search found no product with exactly this name (closest: an iOS app "VoiceLog" and a GitHub repository "voicog", both different).
- Alternatives rejected: Vocalstat, Voxstat, Vocstat, Vocalscope, Vocalmetrie, Tessiture, Mesure, keeping `discord-stats`.
- Consequences / risks accepted: not checked as a GitHub repository or organisation name, nor for domain names. The project folder on disk still has its old name and was not renamed (a running bot has it open); rename it when convenient, then re-run `npm ci`.

## 2026-11-17 — Make the bot raspi-manager-ready: required absolute DB_PATH, Node pin, README
- Decision: `DB_PATH` is required and must be absolute (no default inside the application folder); configuration is read and validated in `bot/src/config.ts` with errors that name the key and never the value; `.nvmrc` is `24`; the README has a "Deployment (raspi-manager)" section; `.gitignore` now ignores `data/` and SQLite `-wal`/`-shm` files.
- Why: raspi-manager replaces the application folder on update and rollback, so data must live elsewhere; a missing key makes systemd restart in a loop, so the bot must fail clearly. The audit also found that SQLite's `-wal` and `-shm` files were not ignored and would have been committed with real presence data.
- Alternatives rejected: a default `./data` path (lost on update); relative paths (resolve against the application folder).
- Consequences / risks accepted: a nightly backup job and a two-process app are not supported by raspi-manager as far as the contract shows; briefs saved in docs/RASPI-MANAGER-REQUESTS.md. Node 24 and the arm64 build of `better-sqlite3` are still unverified on the Pi.

## 2026-11-17 — Record only allow-listed servers
- Decision: the collector records only servers listed in the required environment variable `ALLOWED_GUILD_IDS`; startup fails with a clear message if it is missing or empty. Set to two servers on 2026-11-17.
- Why: the bot is present on 5 servers; the developer chose to record only the two active ones. Failing loudly beats silently recording everything.
- Alternatives rejected: recording every server the bot is in (surprising for friends on unintended servers); leaving the list optional (silent default of "everything").
- Consequences / risks accepted: events already journaled for a server later removed from the list stay in the append-only journal (none existed for the three excluded servers at the time).

## 2026-11-17 — Run TypeScript directly with Node, no transpiler
- Decision: `bot/` and `server/` run `.ts` files with Node's native type stripping; `erasableSyntaxOnly` is on (no enums, no parameter properties); `VoiceFlag` is a `const` object. `tsc --noEmit` is the typecheck only.
- Why: fewer dependencies and no build step on the Pi. Dev machine has Node 26.13.1; production floor is Node >= 24 (`engines`).
- Alternatives rejected: tsx or ts-node (extra dependency), compiling to JavaScript (extra step).
- Consequences / risks accepted: imports need explicit `.ts` extensions; Node version on the Pi must support type stripping (to verify).

## 2026-11-17 — Dependencies added in slice 1
- Decision: `better-sqlite3` 13.2.0 and `discord.js` 14.28.1 (bot), `@types/node` 24.19.2 and `@types/better-sqlite3` 9.6.0 (dev, MIT, DefinitelyTyped, publisher `types`), `typescript` 7.0.2, `vitest` 5.1.0.
- Why: approved stack plus the types packages approved by the developer. `@types/node` 24 matches the production floor, not the dev machine's Node 26.
- Consequences / risks accepted: `npm audit` reports 5 high findings, all `picomatch` (ReDoS) through vite/vitest — dev tooling only, never deployed. The suggested fix would downgrade vitest to 3.1.4, so it is not applied; recheck at the next dependency review. npm warns that the `better-sqlite3` install script (`node-gyp rebuild`) is not approved; it loaded fine on Windows without it, so check the Pi explicitly.

## 2026-11-17 — Journal `raw_json` is a state snapshot, not the gateway payload
- Decision: each event stores the normalised columns plus a JSON snapshot of the old and new voice state fields (channel, mute, deaf, server mute/deaf, stream, camera), not the raw gateway packet.
- Why: discord.js delivers parsed states in `voiceStateUpdate`; capturing the packet needs the `raw` event and matching it to the event.
- Alternatives rejected: capturing `VOICE_STATE_UPDATE` packets via the `raw` event (more complex ordering; see QUESTIONS).
- Consequences / risks accepted: a field Discord adds later is not kept unless the snapshot is extended.

## 2026-11-17 — Visual direction: "Rail and table" (variant 23), light and dark
- Decision: left rail, period selector, key figures, member table with hourly mini-bars, heatmap, records. Sober, strict grid, one accent colour per theme (forest green on light, mint on dark). Details in docs/DESIGN.md.
- Why: chosen by the developer after four rounds of options (about 25 mockups). They disliked playful, dense-poster and editorial styles and kept "sober, serious, one colour, strict grid", then preferred the dense table/instrument family.
- Alternatives rejected: arcade, recap, studio, brutalism, Japanese minimalism, terminal, metro map, risograph, Swiss poster, kawaii, constructivist, Bauhaus, giant type, data-art, financial press, tabular and dial variants.
- Consequences / risks accepted: a serious look suits statistics but is less playful for a friends' recap; the recap view may need its own treatment later.

## 2026-11-17 — Stack and tier
- Decision: T1. Node 24 LTS, TypeScript 7.0.2, discord.js 14.28.1, better-sqlite3 13.2.0, Fastify 5.12.8, Vite 8.3.8 with Preact 11.2.0, Vitest 5.1.0. One repo with `bot/`, `server/`, `web/`, `shared/`.
- Why: one language for collector and dashboard; light on a Pi; versions read from the npm registry on 2026-11-17; Node 24 LTS until 2028-04-30 (nodejs.org release schedule, via search results; Node 26 becomes LTS on 2026-10-28 per the same schedule).
- Alternatives rejected: `node:sqlite` (release candidate, kept as fallback), Python/discord.py and Go/Rust (developer chose TypeScript), chart libraries (CSS is enough), a full SPA framework such as React (heavier than needed).
- Consequences / risks accepted: arm64 prebuilt binary of better-sqlite3 and Node version on the Pi not verified; checked in slice 1.

## 2026-11-17 — Append-only raw event journal as source of truth
- Decision: store every voice event with its raw JSON and never delete it; sessions and aggregates are derived and rebuildable. Reconcile at start using a heartbeat.
- Why: the developer wants to compute unforeseen statistics retroactively; Discord provides no voice history, so every day of missed collection is lost.
- Alternatives rejected: storing only sessions or aggregates (not retroactive); storing everything including message data (dropped by the developer).
- Consequences / risks accepted: the only deletion is a member's own request (F8).

## 2026-11-17 — Voice only, no message data, no privileged intent
- Decision: collect voice states only. No message content or metadata, no presence.
- Why: the developer chose it ("forget written messages, keep voice stats"). Without the message-content intent, message text, embeds and attachments arrive empty (Discord documentation, via search); only `GuildVoiceStates` (non-privileged) is needed.
- Alternatives rejected: message metadata (was chosen earlier, then dropped), message content, presence and games.
- Consequences / risks accepted: no written-activity statistics, ever, unless a new decision reopens this.

## 2026-11-17 — Web dashboard with Discord login, hosted on a Raspberry Pi
- Decision: web site, OAuth2 scopes `identify guilds`, a user sees servers they belong to where the bot is present. Hosted through raspi-manager (systemd + Cloudflare Tunnel).
- Why: richest way to show varied statistics; no passwords to manage; data stays on the developer's hardware.
- Alternatives rejected: Discord commands only, shared private link, open access, PC hosting, cloud VPS.
- Consequences / risks accepted: a few private servers means data is separated per server (guild id on every row).

## Pending
- Linter and formatter choice (first slice).
- Exact opt-out and deletion commands (see QUESTIONS).
