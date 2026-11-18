# Product specification
Source of truth for scope and behaviour. Status: `planned` · `in progress` · `done` · `dropped`.

## Overview
A Discord bot records voice events into a permanent journal. A web dashboard, behind Discord login, shows statistics from that journal. Users see only servers where they are a member and where the bot is present.

## Out of scope
Written messages (content or metadata), presence and games, history before launch, public bot, other authentication, live updates.

## Screens and navigation
One full-width dashboard page: server selector, period selector (7 days / 30 days / 1 year / all), light and dark themes, key figures, members, heat map, channels, records. No side navigation until a second page exists (member profile, yearly recap).

## F1 — Voice event collection
Status: `done` (verified live on 2026-11-17: join, leave, move and state events with mute, deaf and stream flags, plus one heartbeat per minute)
- Records join, leave, move, and state changes (mute, deaf, stream, camera, server mute) with UTC millisecond timestamps, the raw Discord payload, and a source (`live` or `reconcile`).
- Records only servers listed in `ALLOWED_GUILD_IDS` (required; startup fails without it).
- Writes a heartbeat every minute, but only while the gateway connection is ready and every watched server is available.
- Also records, for later use: the AFK channel of each server, the type of each voice channel (voice or stage, including empty ones), the name each person shows on each server, and a history of every name (server, channel, username, display name) so renames do not rewrite the past.
- Never crashes on one bad event; logs and continues.

## F2 — Startup reconciliation
Status: `in progress` (verified live: startup resync of each server and a restart with nobody having left; the "someone left during the outage" paths, at restart and after a lost connection, are covered by unit tests only)
- Also runs for one server whenever it becomes available again after a lost connection (`guildAvailable`; Discord rebuilds the voice states then). Sessions are closed at the moment the loss began (the last heartbeat before it), never at the time of the resync. A resumed connection (`shardResume`) needs nothing: Discord replays the missed events.
- On start, compares journal sessions still open with who is actually in voice.
- Closes missing sessions at the last heartbeat (not at restart time); opens those still active, marked `reconcile`.

## F3 — Session derivation
Status: `done`
- Builds sessions (user, channel, start, end) from the journal; rebuildable at any time; unit-tested with gaps, moves and duplicate events.

## F4 — Discord login and access
Status: `in progress` (built and covered by tests with a fake Discord; the real Discord round trip and the screens in a browser are not yet checked)
- OAuth2 with the two non-privileged scopes `identify` and `guilds`. The Discord access token is used once at login and never stored, logged or put in a cookie.
- Signed session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` over https), valid 7 days. It holds the Discord id, the name, the `@username` (cookies made before 2026-11-18 lack it and simply show none) and the servers the person shares with Vocalog, fixed at login: leaving a server takes effect at the next login or when the cookie expires. A forged, altered or expired cookie counts as nobody.
- Every statistics route answers 401 without a session. Only `/api/me` is open, to say whether a login is needed. A person sees only servers they belong to and that Vocalog records; any other server answers exactly like one that does not exist (404).
- Visibility of a member page: since 2026-11-18 every person who can see a server sees the full member page of any member of it, including microphone, headphones, screen-sharing and camera time and the group's muted share (the earlier hide-from-others rule was removed, see DECISIONS).
- Screens: login (with the reasons for a refusal), logged in with the name and a logout button, "toi" marked in the member list.
- Local development without login only with `INSECURE_NO_AUTH=1`, which the server refuses to combine with the login settings.
- Not covered: a person in more than 200 servers (Discord returns 200 per request); CSRF tokens on logout (cookies are `SameSite=Lax`, which blocks cross-site POSTs); a content security policy (to add after checking the page in a browser).

## F5 — Summary dashboard
Status: `in progress` (API and page built and unit-tested; not yet checked in a browser; behind the Discord login of F4)
- Key figures (average per day, total, longest session, current streak), member table with hourly profile (title shows the member count; the 6 most active are listed, a button shows or hides the rest, so a long list leaves no empty gap beside the heatmap), day × hour heatmap, records and channels (the pairs section was removed on 2026-11-18).
- Hourly profile in the member list: one bar per hour, all 24 hours always shown, the day starting at 06:00 so an evening that passes midnight is one block. An hour with nobody keeps a thin mark (a baseline), so a member who rarely connects does not leave a blank. The highest bar of each member is in colour.
- Header (since 2026-11-18), two rows. Top bar: the server with its picture (a rounded square; initials when it has none) and the server selector on the left; on the right the logged-in person (picture, name and `@username`, "Déconnexion") and the theme button. Title row: the page title and, only on pages the period changes (the dashboard and a member page), the period selector. A single day ignores the period, so its page has no selector (the period still travels in the links to come back to it).
- Loading and appearing (since 2026-11-18): a page that is loading shows grey placeholders shaped like the page (heights measured on the demo data, within about 3 % of the real page at phone, tablet and desktop widths), including the very first visit before the script has loaded (static placeholder in `index.html`). Changing the period keeps the current page in place, dimmed, until the new figures arrive; another member or another day never shows under a new title. Answers already seen come back at once (kept in memory, refreshed in the background after 30 s). Hovering, focusing or touching a link to a member or a day starts loading it, and a day page quietly loads the day before and after. When the data arrives the page rises 6 px while fading in (150 ms, cards 30 ms apart), gauges and bars fill, and a change of period moves them instead of jumping. All motion is off with `prefers-reduced-motion`.
- Day page: the choice between "zoom on the activity" and "the whole day" is kept when moving to another day and after a reload (browser storage, per viewer).
- Home page heading: just "Vocalog" (since 2026-11-18 the owner dropped the descriptive title). Charts carry no explanatory captions: titles, axes and tooltips are enough; definitions of terms such as "Ouvre le salon" or "Micro coupé" live in tooltips, and each chart keeps an accessible text label.
- Avatars (since 2026-11-18): a round picture next to every name in the member list, the member page title, "Avec qui" and the day page; initials in a neutral circle when a person has none or it cannot load. The bot stores the Discord avatar hash (`users.avatar`, migration 003); the server fetches the image from Discord and serves it, so a visitor's browser never contacts Discord. Only avatars seen after the bot restarts with this version exist. The same goes for server icons (`guilds.icon`, migration 004), refreshed whenever the bot sees the server.
- Names: the name a person shows on that server, followed by their Discord `@username` in small muted text when it differs (member list, member page title, "Avec qui" list). The handle is hidden when it equals the name, ignoring case.

## F5b — Days and timelines
Status: `in progress` (built and unit-tested; checked in a headless browser at 390, 768 and 1280 px on demo data, light and dark for the main views; not yet with the real login or real avatars)
- A "day" runs from 06:00 to 06:00 local time, so an evening past midnight stays whole (23 or 25 hours on a daylight saving day).
- Home page, section "Jour par jour": one line per day of the period, newest first, at most 31 (14 shown, a button shows all). Each line has 48 half-hour cells in the accent colour, darker for more people, plus the day's voice time; it opens the day page.
- Day page `/jours/<YYYY-MM-DD>?serveur=&periode=`: previous and next day buttons, key figures (total time, people, most at once and when), a presence strip, and one row per member with a bar per stay (channel name in the bar and in the tooltip), first arrival first. It zooms on the hours where something happened (button for the whole day) and offers the same data as a table. An empty day says so; a date in the future or a bad date is refused.

## F6 — Time together
Status: `in progress` (the per-member calculation is done and tested in `shared/` (the pair ranking and its code were removed on 2026-11-18); it appears per member as "best voice friends" in F7)
- Time two members spend in the same channel at the same time, computed from interval overlaps; pair ranking.

## F7 — Member profile and yearly recap
Status: `in progress` (member page built and tested; not yet checked in a browser; yearly recap not started)
- Member page at `/membres/<id>?serveur=<id>&periode=<period>`, reached from the member list, with a back link.
- Personal key figures: total (with change versus the previous period of the same length), average per day, sessions, longest session, current streak and record.
- Day-by-day activity (per week for windows over 92 days), the member's own day × hour heat map, time with others versus alone and the ranking of who they spend time with.
- Voice states as time and share of voice time: microphone off (muted or deafened by the user; a moderator's server mute is not counted), headphones off, screen sharing, camera.
- Habits: average arrival and departure time (on a day that starts at 06:00), share of time by morning, afternoon, evening and night, compared with the group.
- Comparison with the group: rank, total and session length versus the group average, muted share, arrival time.
- Rooms and nights: times the member opened a room (first in an empty channel) and closed it (last to leave), sessions that pass 03:00, best streak.
- Definition of "together": same channel at the same time (regardless of mute).
- Yearly recap: `planned`.

## F8 — Opt-out and deletion
Status: `dropped` (2026-11-18, the owner does not need it; friends are told what is collected)
- Was: a member can stop being recorded and ask for deletion of their data. Not built; the journal has no exception to append-only.

## F9 — Backup and operation
Status: `in progress` (backup script done; no schedule yet)
- Nightly `VACUUM INTO` backup; systemd restart on failure; deployment via raspi-manager.
- `scripts/backup.ts` makes the copy and prunes old ones (done, tested); it must still be run by hand or by a timer written on the Pi, because raspi-manager has no scheduled jobs yet (see docs/RASPI-MANAGER-REQUESTS.md). The bot and the dashboard are deployable without it (two processes, `processes:`); moving the app with its data is covered by raspi-manager's move operation.

## Open questions
See docs/QUESTIONS.md.
