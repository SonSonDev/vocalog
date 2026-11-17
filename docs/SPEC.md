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
Status: `planned`
- OAuth2 with scopes `identify guilds`; signed HTTP-only session cookie.
- A user sees only servers they belong to and where the bot is present.
- States: logged out, no server, error, content.

## F5 — Summary dashboard
Status: `in progress` (API and page built and unit-tested; not yet checked in a browser; no login yet, so local use only)
- Key figures (average per day, total, longest session, current streak), member table with hourly profile, day × hour heatmap, records, pairs and channels.

## F6 — Time together
Status: `in progress` (the pair calculation is done and tested in `shared/`; its ranking was removed from the summary page on 2026-11-18; it returns per member as "best voice friends" in F7)
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
Status: `planned`
- A member can stop being recorded and ask for deletion of their data (the only allowed exception to the append-only journal). Exact commands to define (see QUESTIONS).

## F9 — Backup and operation
Status: `planned`
- Nightly `VACUUM INTO` backup; systemd restart on failure; deployment via raspi-manager.
- Needs a scheduled job that raspi-manager does not offer yet (see docs/RASPI-MANAGER-REQUESTS.md); the bot is deployable without it.

## Open questions
See docs/QUESTIONS.md.
