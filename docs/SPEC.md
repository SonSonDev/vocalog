# Product specification
Source of truth for scope and behaviour. Status: `planned` · `in progress` · `done` · `dropped`.

## Overview
A Discord bot records voice events into a permanent journal. A web dashboard, behind Discord login, shows statistics from that journal. Users see only servers where they are a member and where the bot is present.

## Out of scope
Written messages (content or metadata), presence and games, history before launch, public bot, other authentication, live updates.

## Screens and navigation
Rail on the left (Summary, Members, Pairs, Channels), period selector (7 days / 30 days / 1 year / all), server selector. Light and dark themes. Below 600 px the rail becomes a bottom bar.

## F1 — Voice event collection
Status: `done` (verified live on 2026-11-17: join, leave, move and state events with mute, deaf and stream flags, plus one heartbeat per minute)
- Records join, leave, move, and state changes (mute, deaf, stream, camera, server mute) with UTC millisecond timestamps, the raw Discord payload, and a source (`live` or `reconcile`).
- Records only servers listed in `ALLOWED_GUILD_IDS` (required; startup fails without it).
- Writes a heartbeat every minute while running.
- Never crashes on one bad event; logs and continues.

## F2 — Startup reconciliation
Status: `in progress` (verified live: after a forced kill and restart with nobody having left, 0 events written; the "someone left during the outage" path is covered by unit tests only)
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
Status: `planned`
- Key figures (average per day, total, longest session, current streak), member table with hourly profile, day × hour heatmap, records, pairs and channels.

## F6 — Time together
Status: `in progress` (pure calculation done and tested; API and UI pending)
- Time two members spend in the same channel at the same time, computed from interval overlaps; pair ranking.

## F7 — Member profile and yearly recap
Status: `planned`
- One page per member with own figures and best voice friends; a yearly recap view.

## F8 — Opt-out and deletion
Status: `planned`
- A member can stop being recorded and ask for deletion of their data (the only allowed exception to the append-only journal). Exact commands to define (see QUESTIONS).

## F9 — Backup and operation
Status: `planned`
- Nightly `VACUUM INTO` backup; systemd restart on failure; deployment via raspi-manager.
- Needs a scheduled job that raspi-manager does not offer yet (see docs/RASPI-MANAGER-REQUESTS.md); the bot is deployable without it.

## Open questions
See docs/QUESTIONS.md.
