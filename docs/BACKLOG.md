# Backlog
Diagnosis of 2026-11-18 (code read in full for `server/`, `bot/` and the aggregation in `shared/`; web app read partially; nothing run against the real database or a browser). Priority: **P1** do next · **P2** soon · **P3** later. Effort: S under half a day · M one to two days · L more. Items marked done are built and tested. Pick an item, say so, and it moves into SPEC when built.

## How this was measured
Synthetic journal (15 people, 4 channels, one year), `buildSummary` and `buildMemberProfile` on a read-only database, Node 26 on the developer's PC (the Pi runs Node 24 and is slower, probably 3 to 5 times):

| Events | Summary 30 days | Member 30 days | Summary all | Member all |
|---|---|---|---|---|
| 21 000 | 83 ms | 91 ms | 174 ms | 267 ms |
| 120 000 | 373 ms | 712 ms | **3 391 ms** | **4 419 ms** |

The work is synchronous on the single Node thread: while one "all" request computes, every other request waits.

## 1. Performance and data layer
| ID | Pri | Size | Finding and proposal |
|---|---|---|---|
| P-1 | ✅ done 2026-11-18 | S | `aggregate()` computes pair totals (`togetherByPair`, quadratic per channel) that nothing displays since the pairs section was removed on 2026-11-18. Drop `pairs` from `Aggregate` (or compute it only on demand). Free speed-up on every summary. |
| P-2 | ✅ done 2026-11-18 | S | `streaks()` runs over the whole history on every summary and every profile (`hourSlices` on every session ever). Compute days per session once, or cache per server. |
| P-3 | P1 | M | `localParts` calls `Intl.DateTimeFormat.formatToParts` for every hour slice of every session: the hot spot. Resolve the UTC offset once per local day (or per DST change) and do integer arithmetic. Expected gain: several times faster, same results (keep the existing tests as the safety net, add a DST test). |
| P-4 | ✅ done 2026-11-18 | S | Cache the answer of a statistics route per (server, period, route, member) and invalidate it with `MAX(id)` of `voice_events` plus a one-minute bucket for open sessions. The journal is append-only, so invalidation is exact. Removes repeat cost entirely (period switches, page reloads, several friends). |
| P-5 | P2 | S | `buildMemberProfile` loads the whole server journal, derives all sessions, then aggregates the group twice (current and previous period). Load events only from `fromMs - previous window - the last event before it`, or reuse one clipped session list. |
| P-6 | P2 | S | `roomRoles` scans every other session for each own session (`someoneAt`): quadratic. Sort once and binary-search. Same for `togetherWithUser` on very busy channels. |
| P-7 | P2 | M | If the journal passes about 200 000 events: store derived sessions in a `sessions` table written by the bot (CLAUDE.md allows derived and rebuildable tables), indexed by `(guild_id, start_ms)`, so the server filters by period in SQL. Not needed before P-1 to P-4 are done and measured. |
| P-8 | P3 | S | `heartbeats` grows by 525 600 rows a year and is never pruned. Harmless today; keep only the last few days plus the closing points of past outages. |
| P-9 | P3 | S | Run the measurements above as a repeatable script (`scripts/bench.ts`, synthetic data, refuses to touch a real database) so each perf change is proven. |

After the first batch (P-1, P-2, P-4), same data: summary "all" 3 391 → 481 ms, member "all" 4 419 → 1 424 ms; the 30-day views barely moved (373 → 326 ms and 712 → 662 ms) because loading and deriving the whole journal is now the main cost (P-5, P-3). Repeated requests are served from the cache.

## 2. Security and robustness
No critical flaw found: signed cookie with constant-time check, `HttpOnly`, `SameSite=Lax`, state cookie against forged callbacks, servers outside the person's list answer 404 like unknown ones, read-only database, server bound to loopback, path traversal blocked in static files, token never stored. What remains:

| ID | Pri | Size | Finding and proposal |
|---|---|---|---|
| S-1 | P1 | S | No rate limit on any route. Once a tunnel exposes the server, `/auth/*` can be hammered (each callback calls Discord) and any logged-in friend can trigger the 3 to 4 second "all" computations in a loop (see measures). Add per-IP and per-session limits (`@fastify/rate-limit`, first-party, needs your approval as a new dependency) plus P-4. Behind Cloudflare the real client IP is in `CF-Connecting-IP`: configure `trustProxy` accordingly and only trust it when the request comes from the tunnel. |
| S-2 | ✅ done 2026-11-18 | S | `logger: false` and no error handler: a 500 returns Fastify's default body and nothing is written to the journal of systemd. Log errors (without cookies, codes or query strings that carry `code=`), return a generic JSON body. |
| S-3 | ✅ done 2026-11-18 | S | Check that `LoginView` maps `?erreur=` to fixed messages and never prints the raw value (reflected text). The server only emits known codes, but anyone can craft the link. Add a test. |
| S-4 | P2 | S | No Content-Security-Policy (already listed as not covered in SPEC F4). The app is a Preact bundle with no inline script: `default-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'` is probably enough. Add `Permissions-Policy` (camera, microphone, geolocation off). Check in a browser first. |
| S-5 | P2 | S | `npm audit` and a freshness check against the registry were not run this session (CLAUDE.md asks for it at milestones). Run both before the first exposure. |
| S-6 | P2 | M | Session is a stateless cookie: no way to revoke one (leaving a server takes up to 7 days to apply; a lost phone stays logged in). Options: shorter life (24 h, silent re-login thanks to `prompt=none` already used), or a `session_version` in a small writable file. Recommended: 24 h life, no new state. |
| S-7 | P2 | S | The 200-servers limit of `/users/@me/guilds` is accepted in SPEC; add the `GET /users/@me/guilds/{id}/member` check instead, scope `guilds.members.read`, only if a friend ever hits it. Park. |
| S-8 | P3 | S | `INSECURE_NO_AUTH` is guarded against the login variables but not against a non-loopback bind; the server always binds 127.0.0.1, so a tunnel is the only route in. Keep, but print a loud warning when `PUBLIC_URL` is set with the flag (already refused) and document in the raspi-manager notes. |
| S-9 | P3 | S | Privacy consequence of the 2026-11-18 decision: everyone now sees everyone's mute, headphone, camera and screen-share time. Nothing to build; keep the line in the message the friends receive. |
| S-10 | P3 | S | Local runtime is Node 26 while `.nvmrc` and the Pi say 24. Run tests under 24 before a release (`nvm use`), since type stripping and `node:sqlite` behaviour differ between majors. |

## 3. Correctness of the figures
| ID | Pri | Size | Finding and proposal |
|---|---|---|---|
| C-1 | P1 | M | **AFK time counts as voice time.** The bot stores each server's AFK channel (migration 002) but no figure uses it, so someone parked in the AFK channel inflates totals, streaks and "time together". Exclude the AFK channel from totals and together-time, show it as its own small figure ("AFK"). Needs a unit test and a SPEC line. Product choice: confirm with the developer (it changes every past figure). |
| C-2 | P2 | S | Sessions longer than a plausible limit (for example 16 h) are shown as is; one missed leave event produces a fake record. Show the record with a "check" hint or cap by the next heartbeat gap. Reconcile already covers most cases; the gap case remains (collection gaps are accepted, DECISIONS 2026-11-18). |
| C-3 | P2 | S | `days` for the "all" period starts at the first event of the server, so a server added later makes averages per day look low for members who joined later. Offer "since the first session of the member" on the profile. |
| C-4 | P3 | S | Stage channels (type 13) are counted like voice channels; decide whether listening to a stage counts as time together. |
| C-5 | P3 | S | Names: `members` and `users` are only refreshed on voice events, so a renamed person who is silent keeps the old name until they join. Fixing it needs the privileged members intent, which the project excludes: accept it, no action. |

## 4. UX
| ID | Pri | Size | Finding and proposal |
|---|---|---|---|
| U-1 | P1 | S | Quality gate not met: no captures at 390, 768 and 1280 px, light and dark, and the real Discord login was never exercised in a browser (README and SPEC say so). Do this before anything is exposed. |
| U-2 | P1 | S | "Who is in voice now": open sessions already exist in the journal. A strip at the top of the dashboard ("En vocal maintenant : A, B dans #salon") answers the most common reason to open the page, with no live push (a reload or a 60 s refresh is enough; BRIEF excludes live push, not this). |
| U-3 | P2 | S | `styles.css` is 783 lines, twice the file-size rule. Split by area (base, header, members, profile, heatmap). |
| U-4 | P2 | S | Member table: sort by time, sessions or last seen; search box above 12 members; the collapsed list from 2026-11-18 keeps working. |
| U-5 | P2 | S | Heatmap and spark bars are `aria-hidden` or have no text alternative beyond "most active hour": add a visually hidden table or a summary sentence per row; keyboard focus on cells with a tooltip. |
| U-6 | P2 | S | Period selector: add "this month", "last month", "this year", and a custom range (two dates). The home page has no comparison with the previous period although the profile does: add the change next to each key figure. |
| U-7 | P2 | S | Loading shows a plain "Chargement…" line: use skeleton blocks of the final height so the page does not jump (also fixes the layout shift between collapsed and expanded lists). |
| U-8 | P3 | S | Print or PNG export of the yearly recap and of a member page (share in the Discord server). |
| U-9 | P3 | S | A `/healthz` route (no data) for raspi-manager and for you to see that the server runs. |

## 5. New figures and cross-reading
Everything below is computable from the existing journal; nothing needs a new Discord permission.

| ID | Pri | Size | Idea |
|---|---|---|---|
| F-1 | P1 | M | **Yearly recap** (F7, planned): total, best month, best day, longest session, favourite channel, top three companions, night owl or early bird, change versus last year. Highest "wow" for friends; reuses profile code. |
| F-2 | P2 | M | **Evenings** ("soirées"): a continuous stretch where at least two people are together. Count, length, average and maximum number of people, record evening, who starts and who ends them. Gives the group a unit people recognise, better than raw hours. |
| F-3 | P2 | M | **Affinity instead of raw hours**: time together divided by the smaller of the two totals (or Jaccard), so a heavy user is not everyone's "best friend" by volume alone. Show it next to the hours in "Avec qui". |
| F-4 | P2 | S | **Group records**: busiest day, most people at once (`peak` is already in the summary response but is not displayed), longest group streak, longest evening, record month. |
| F-5 | ✅ done 2026-11-18 (months and weeks on the home page, plus week and month pages) | S | **Month view** on the home page: voice time per month with a moving average (SPEC's brief mentions monthly average, the page only shows daily). |
| F-6 | P2 | M | **Followers**: when A joins, who joins within 10 minutes (and who leaves right after). "Who brings the others" and "who pulls the group". Uses join and leave times only. |
| F-7 | P3 | M | **Compare two members**: overlap of habits (hours, channels), time together, who arrives first. |
| F-8 | ✅ done 2026-11-18 (the year page, and the member page: the last 53 weeks as a contribution grid) | S | **Calendar heatmap** of the year (one cell per day) for the group and per member. |
| F-9 | P3 | S | **Name history** (`name_history` already stores every name): "anciennement …" on the member page, and a fun "most renamed". |
| F-10 | P3 | S | **Badges** for friends: noctambule (sessions past 03:00 already counted), lève-tôt, marathonien, fidèle (streak), ouvreur de salon (room roles already counted). Cosmetic, keep optional. |
| F-11 | P3 | S | **Channel habits**: favourite channel per member, channel moves per session (`move` events are recorded and unused), "nomades". |
| F-12 | P3 | S | **Collector status** ("Collecteur actif, dernier signal il y a 40 s") from the last heartbeat. Different from displaying gaps, which was decided against (DECISIONS 2026-11-18); confirm before building. |
| F-13 | P3 | S | **Export** of one's own figures as CSV or JSON, since opt-out and deletion were dropped. |

## 6. Operations and quality
| ID | Pri | Size | Finding and proposal |
|---|---|---|---|
| O-1 | ✅ done 2026-11-18 | M | Nightly backup (F9): until raspi-manager has scheduled jobs, add `scripts/backup.ts` (VACUUM INTO, keeps the last N, refuses a non-existent source) that you run by hand or from a systemd timer you write on the Pi. The journal cannot be rebuilt. |
| O-2 | P2 | S | Choose and log a linter and formatter (CLAUDE.md: "pick them in the first slice", still open). Suggestion to evaluate online first: ESLint with typescript-eslint, Prettier or Biome. Needs your approval (library policy). |
| O-3 | P2 | M | Browser smoke test (Playwright or the existing Chrome tooling) on seeded demo data: login screen, home, member page, both themes, three widths. Feeds U-1. Needs approval for a dependency. |
| O-4 | P3 | S | Run a milestone check (`/project-checkpoint`) now: about 20 commits since the start, `styles.css` over the size rule, `DECISIONS.md` at 144 lines (fine), docs total 409 lines (fine). |
| O-5 | P3 | S | `ARCHITECTURE.md` still says in its API section that login "must be added"; it is built. Fix in the next change that touches it. |

## Suggested order
1. ✅ Done 2026-11-18: P-1, P-2, P-4, S-2, S-3, O-1.
2. **Make it exposable**: U-1, S-1, S-4, S-5, then deploy and test the real login.
3. **Accuracy**: C-1 (after your decision on AFK), P-3.
4. **What friends will notice**: U-2, F-1, F-2, F-3, F-4, F-5.
