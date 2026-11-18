# Decision log
One entry per decision, newest first. A decision is only changed by a new entry that supersedes it.
Not logged: visual tweaks, tuning values, reverted trials.

## 2026-11-18 — One shared tooltip instead of the browser's `title`
- Decision: a single `TooltipLayer` listens to the document and shows the `data-tip` text of the element under the pointer immediately; every chart and cell uses `data-tip` instead of `title`.
- Why: the native tooltip takes about half a second to appear, which makes scanning a timeline with the mouse feel slow; one listener also costs nothing for the hundreds of cells of the strips and the heat map, where a component per cell would.
- Alternatives rejected: a Tooltip component wrapped around each cell (hundreds of components for no gain); a tooltip library (a new dependency for about 100 lines).
- Consequences / risks accepted: tooltips are not part of the page's text, so anything important must also be available as normal text or in the table view (the strips have a hidden summary per day, the day page a table).

## 2026-11-18 — Avatars through the server, per-day strips and a day page, new home title
- Decision: the home title is "Qui était en vocal" (owner's choice). Avatars: the bot stores the avatar hash of each person (migration 003), the dashboard server fetches the image from Discord and serves it (in-memory cache, `?v=<hash>` so the browser keeps it), initials when there is none. Days run 06:00 to 06:00; the home page gets a "Jour par jour" section (one strip per day, up to 31) and a day page with one row per member, zoomed on the active hours by default.
- Why: the owner asked for avatars and per-day timelines. Through the server, visitors' addresses never reach Discord (same privacy rule that kept external fonts out). A 06:00 day keeps an evening that passes midnight in one piece, as the habits figures already do.
- Alternatives rejected: loading avatars straight from Discord's image host (leaks every visitor's address); storing the image in the database (bigger backups for a cosmetic feature); a categorical colour per channel on the day page (breaks the one-accent rule; the channel is written in the bar and in a table instead); a day from 00:00 to 24:00.
- Consequences / risks accepted: the server now makes outbound requests (to one fixed host, from checked values, redirects refused); avatars appear only after the bot has restarted once on this version and each person has been seen again; a daylight saving day shows 23 or 25 hours and the cell labels ignore the shift; an old avatar already cached by a browser is replaced only when the hash changes.

## 2026-11-18 — Speed up the statistics, log server errors, add a backup script
- Decision: removed the pair ranking and its code (`togetherByPair`, `pairKey`, `overlapMs`), unused since the pairs section went away; streaks count local days of a session by range instead of cutting it by hour; the server caches answers (in memory, bounded) keyed by route, server, member and period and valid while the last journal id and the minute are unchanged; server errors are logged by route and answered with a generic 500; `scripts/backup.ts` makes consistent copies and prunes old ones; the login error code from the URL is looked up with `Object.hasOwn`.
- Why: on a synthetic journal of 120 000 events, the "all" summary took 3.4 s and the member page 4.4 s on one blocking thread (now 0.5 s and 1.4 s). The journal is append-only, so the last id is an exact signal that cached answers are stale. The backup cannot wait for raspi-manager scheduled jobs, since the journal cannot be rebuilt.
- Alternatives rejected: a `sessions` table written by the bot (more moving parts; revisit past about 200 000 events, see BACKLOG P-7); a cache library (not needed for 200 entries); keeping the pair code for later (git has it).
- Consequences / risks accepted: a name changed by the bot can show up to one minute late; the 30-day views are still about 0.3 to 0.7 s on 120 000 events because every request loads and derives the whole journal (BACKLOG P-3, P-5); the backup is not scheduled yet.

## 2026-11-18 — Drop the per-member visibility rule and the opt-out feature (F8)
- Decision: any person who can see a server sees every member's full page, including microphone, headphones, screen-sharing and camera time and the group's muted share. The server no longer removes these fields (`restricted` and the nullable `voiceStates` are gone from the API). F8 (opt-out and deletion) is dropped: no `/optout`, no deletion path.
- Why: the owner's call; the dashboard is for a few friends who know what is collected, and the rule added code and a special page state for little gain.
- Alternatives rejected: keeping the rule only for muted/deafened time; keeping a manual deletion on request.
- Consequences / risks accepted: friends can see each other's mute and camera habits; nobody can ask the system to stop recording or erase them (a request to the owner would mean editing the database by hand). Supersedes the visibility rule of the 2026-11-18 login entry and the deletion exception in older entries.

## 2026-11-18 — Deploy the collector and the dashboard as two raspi-manager processes
- Decision: one raspi-manager app with two processes: `bot` (update rule `keep`) and `web` (`restart`). Scheduled jobs are still missing, so the nightly backup stays manual.
- Why: the updated raspi-manager supports several processes per app and moving an app with its data (both built, tested on a fake Pi). `keep` stops an update from cutting the voice sessions the collector is tracking; the web server has no such state.
- Alternatives rejected: a shell wrapper running both (one crash restarts both); two apps from one repository (updates not tied together).
- Consequences / risks accepted: a kept bot runs old code until restarted by hand, so a migration must stay compatible with it (already the rule in the README). The scheduled-job request in docs/RASPI-MANAGER-REQUESTS.md stays open; the two other requests are done.

## 2026-11-18 — Discord login, sessions and who sees what
- Decision: the dashboard needs a Discord login. OAuth2 with the scopes `identify` and `guilds` (both non-privileged). The server keeps no database of sessions: a signed cookie (HMAC-SHA256, constant-time comparison) holds the Discord id, the name and the servers the person shares with Vocalog, for 7 days; the Discord access token is used once and discarded. The OAuth `state` is a random value in a short-lived cookie checked on return. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` over https. Every statistics route answers 401 without a session; a server the person is not in answers 404 exactly like a missing one. On another member's page the server removes microphone, headphones, screen-sharing and camera time and the group's muted share; a person sees their own page in full. The server refuses to start with neither the four login variables nor `INSECURE_NO_AUTH=1`, and refuses to start with both, so a forgotten flag cannot open the dashboard; the example secret is shorter than the minimum so a copied example fails fast. No new dependency: `fetch` and `node:crypto`.
- Why: the dashboard shows friends' presence, so it must not be reachable without a login before any tunnel is pointed at it. Visibility rule chosen by the owner: full for oneself, lighter for others. A stateless cookie fits a server that opens the database read-only. Checking the server list at login and storing only the shared servers keeps the cookie small (browsers cap it near 4 KB; a person can be in 200 servers).
- Alternatives rejected: a session table (the server must not write); keeping the access token to refresh the server list (more to protect for no gain here); Cloudflare Access instead of a login (a manual setting whose mistake exposes the data); hiding the sensitive card only in the browser (the data would still be in the response); an `@fastify/*` cookie or OAuth plugin (extra dependencies for little code).
- Consequences / risks accepted: leaving a server only takes effect at the next login or after 7 days; people in more than 200 servers may miss one (Discord returns 200 per request); no CSRF token on logout (cookies are `SameSite=Lax`); no content security policy yet, to add once the page has been checked in a browser; the real Discord round trip is covered by tests with a fake Discord only; rotating `SESSION_SECRET` logs everyone out.

## 2026-11-18 — Collection gaps are accepted and not displayed
- Decision: no coverage detection and no warning banner for now. A period when the collector heard nothing (bot stopped, Pi off, connection lost) stays a gap in the statistics, shown as if nobody was in voice, apart from the sessions the collector closes at the moment a loss began and the resync on reconnection.
- Why: owner's choice ("on va laisser des trous"). Discord provides no voice history, so a gap cannot be filled, only signalled.
- Alternatives rejected: a coverage figure and banner built from the heartbeat table (gaps longer than about 2.5 minutes), days marked incomplete on the activity chart, and a count of time attributed across an outage ("uncertain time"). All are feasible later without any schema change, because the heartbeats are already stored, but only heartbeats written after the 2026-11-18 collector fix are trustworthy for connection losses; older ones cover process and Pi outages only.
- Consequences / risks accepted: statistics can undercount after an outage without saying so; totals should be read as "at least". Revisit if a missing stretch ever misleads someone.

## 2026-11-18 — better-sqlite3 ships its own binaries; compiling is never needed
- Decision: nothing changes in the stack. Recorded so the earlier "arm64 binary not verified" note is closed: better-sqlite3 13.2.0 contains `prebuilds/` for linux-arm64, linux-x64, linuxmusl, darwin and win32. npm still tries an implicit `node-gyp rebuild` because the package has a `binding.gyp`; on a machine without a C++ toolchain a clean `npm ci` then fails, and `npm ci --ignore-scripts` works (checked in a clean checkout on Windows without Visual Studio).
- Why: found while validating the collector commit in a clean checkout. The Pi built it fine (the owner ran the database check there), so no change is needed there.
- Alternatives rejected: forcing `ignore-scripts=true` in a project `.npmrc` (would also hide any future legitimate install script); node:sqlite (still a release candidate).
- Consequences / risks accepted: if a future Pi update makes `npm ci` try to compile and fail, switch the raspi-manager build command to `npm ci --ignore-scripts`.

## 2026-11-18 — Collector: honest heartbeat, resync after a lost connection, more data
- Decision: (1) the heartbeat is written only while the gateway is ready and every watched server is available (`shouldWriteHeartbeat`); (2) a server is resynchronised on `guildAvailable` (at start, and after a full reconnection) with `reconcileJournal({ guildId, aliveUntilMs })`, closing sessions at the last heartbeat before the loss, remembered through `shardDisconnect` and `guildUnavailable` and forgotten on `shardResume`; the start-up reconcile leaves unavailable servers alone; (3) migration 002 adds the AFK channel of each server, the channel type, the name shown by each member on each server, and a name history; (4) the dashboard shows the per-server name when known, else the username.
- Why: found while reviewing the collector. The heartbeat used to be written every minute even when disconnected, and the journal was only reconciled at the first start, so a lost connection could leave ghost sessions that a later restart would close at a falsely recent time. Verified in discord.js 14.28.1 sources: `READY` marks guilds unavailable, `GUILD_CREATE` makes them available again (event `guildAvailable`) and the voice state cache is cleared and rebuilt from the payload. The AFK channel, channel type and names cannot be rebuilt later, so they are collected now.
- Alternatives rejected: reconciling on `shardReady` (guilds are not loaded yet at that point, so every session would look vanished); a per-server heartbeat table (more schema for a rare case: a server outage while the process also crashes); storing the raw gateway payload (still open in QUESTIONS).
- Consequences / risks accepted: while any watched server is unavailable no heartbeat is written, so if the process also crashes then, other servers' sessions are cut at an older time (an undercount, never a ghost session). Display names refresh when the person appears in a voice event or at a (re)sync, not on every change, because the member-update event needs a privileged intent. The AFK channel is the current value, used for the whole past. Verified live at start-up only; the disconnect, re-identify and resync path is covered by unit tests, not exercised against Discord.

## 2026-11-18 — Member pages: content and definitions
- Decision: each member has a page (`/membres/<id>`) with personal statistics. Chosen by the owner: key figures, own heat map, who they spend time with, day-by-day activity, comparison with the group, microphone-off time, screen-sharing time, time with others, plus four of my ideas (camera and headphones-off time; habits and change versus the previous period; opening and closing rooms; streaks and late nights). Definitions applied: "microphone off" = muted or deafened by the user, a moderator's server mute is not counted; "with others" = same channel at the same time, counted once when several people are there, and "alone" is the rest; a member's day starts at 06:00 when averaging arrival and departure times, so 23:00 and 01:00 average to midnight; "opened a room" = joined a channel nobody else was in, "closed" = left with nobody staying; "late night" = a session that includes the 03:00 to 03:59 local hour; the previous period has the same length as the selected one, and nothing is shown when it is empty. Windows are cut at the first recorded event, so a young journal is not averaged over unrecorded days. Activity is per day up to 92 days, per week beyond. Pairs are no longer on the summary page (see below).
- Why: owner's choices after seeing the summary page; the definitions are mine where the request was ambiguous, and are listed so they can be corrected.
- Alternatives rejected: "with others" as "connected at the same time in any channel" (not what the owner described, and not provable from channels alone); counting a server mute as muted (not the member's own choice); a react-router dependency (a 50-line History router is enough); comparing with a median instead of the average (average is easier to read for a small group).
- Consequences / risks accepted: the page has not been checked in a browser. Sensitive per-member behaviour (muted, deafened, camera) will need a visibility rule when login exists (see QUESTIONS). The "microphone off" and "deafened" shares depend on the bot having recorded every state change; time before a state change that the bot missed is attributed to the previous state.

## 2026-11-18 — Remove the pairs section from the summary page
- Decision: the "time together" ranking is no longer shown on the summary page, and `pairs` is no longer part of the summary API response. `togetherByPair` and `aggregate().pairs` stay in `shared/` (tested) for the per-member pages.
- Why: owner's request after reviewing the new layout ("retire la section paire"), together with the plan to give each member a dedicated page with personal stats, where "who I spend time with" fits better.
- Alternatives rejected: keeping the section but hiding it (dead data in the response); deleting the calculation (needed for member pages).
- Consequences / risks accepted: the group-level view of pairs is gone until it is reintroduced on purpose.

## 2026-11-18 — Drop the side rail; full-width grid; members as a list
- Decision: removed the left navigation rail and the bottom bar. The page is a single dashboard: header (server, period, theme), key figures, then a 12-column grid up to 1680 px (members 7 columns + heat map 5; pairs, channels and records 4 each). Between 700 and 1199 px the big cards are full width and the small ones share rows; under 700 px everything stacks, the controls form a compact block, key figures are 2 by 2, and each member takes two lines. Members are a list, not a table, so they reflow without sideways scrolling.
- Why: owner's feedback after seeing the page: the rail buttons only scrolled the same page and "serve little"; the width was badly used on desktop; the mobile view was weak. This supersedes the "Rail and table" navigation of the 2026-11-17 design decision; the dense table/grid look, tokens and themes stay.
- Alternatives rejected: keeping the rail for future pages (dead navigation today); a top tab bar (nothing to switch between yet); a bottom bar on phones (same reason).
- Consequences / risks accepted: navigation will be added back (probably top tabs) when a second page exists, such as the member profile. The mobile layout is reasoned, not yet checked in a browser: the owner said it was "not great" and the exact complaint is not known.

## 2026-11-17 — Dashboard slice: API and page before Discord login
- Decision: built `server/` (Fastify 5.12.8, read-only access to the bot's database) and `web/` (Vite 8.3.8 + Preact 11.2.0) before the Discord login. Until login exists the server refuses to start unless `INSECURE_NO_AUTH=1`, binds `127.0.0.1` only, and `.env.example` ships `INSECURE_NO_AUTH=0`. API types live in `shared/src/api.ts`. Statistics are computed on demand from the journal in a configured time zone (`STATS_TIME_ZONE`, default `Europe/Paris`).
- Why: the owner wanted to see statistics now; collection already runs on the Pi. A refusal to start is safer than a public unauthenticated page (a tunnel would expose it).
- Alternatives rejected: shipping without a guard (data of friends exposed through a tunnel); building login first (delays seeing results); extra Fastify plugins or a static-file dependency (a small safe resolver covers it).
- Consequences / risks accepted: the dashboard must not be deployed on the Pi until login is built. Only `@fastify/*` plugins are avoided, no new dependency was added beyond the approved list.

## 2026-11-17 — System fonts for now, no external font service
- Decision: the web app uses the system font stacks instead of Public Sans and JetBrains Mono from docs/DESIGN.md.
- Why: loading fonts from a public font service would send every visitor's address to that service; licence and self-hosting were not verified.
- Alternatives rejected: Google Fonts link (privacy); self-hosted fonts (needs a licence check first).
- Consequences / risks accepted: the look differs slightly from the mockups; revisit by self-hosting after checking the licences.

## 2026-11-17 — First deployment on the Pi; PC history not merged
- Decision: Vocalog's bot was deployed on the Raspberry Pi (verified from the owner's output: integrity `ok`, a fresh heartbeat, 10 journal events at start). The development bot on the PC was then stopped, and the PC database was kept as an archive; its 32 events (2026-11-17 21:59 to 22:51 UTC) were not imported.
- Why: the owner chose to start from the Pi's database rather than merge. Only test-day data was at stake.
- Alternatives rejected: replacing the Pi database with the PC copy (small gap, overwrites the Pi journal); a merge command that imports only events older than the Pi's first event (no gap, no stop; not built).
- Consequences / risks accepted: the Pi journal starts at 2026-11-17 22:46:30 UTC with reconcile joins. The PC archive is `data/` (git-ignored) plus a verified hot backup in `backups/`; keep them until the owner decides to delete them. A merge command can still be built later, since the archive stays.

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
