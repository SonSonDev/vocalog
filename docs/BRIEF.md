# Brief
- **Goal / what it does**: A Discord bot collects voice-channel events (joins, leaves, moves, mute, deaf, stream, camera) into a permanent raw journal. A web dashboard turns it into statistics about the group's time in voice: average time per day and month, hourly heatmap, time spent with each other member, most used channels, session records, a profile page per member, an end-of-year recap.
- **Audience & what a good day looks like**: The developer and friends on a few private servers (about 5–20 people each). A good day: open the dashboard on the PC or phone, log in with Discord, and see who we spent the month with, without anyone having to maintain anything.
- **Ambition / tier**: T1 personal tool, one developer, not published.
- **Scale**: a few private servers, tens of thousands of events per year, one SQLite file, one Raspberry Pi.
- **Constraints**: runs on a Raspberry Pi through raspi-manager (systemd + Cloudflare Tunnel); no privileged Discord intent; friends are informed of what is collected; no secrets or personal data in the repository.
- **Non-goals**: written-message data of any kind, presence and game activity, history from before the bot started (Discord does not provide it), a public bot for any server, authentication other than Discord, live push updates.

## Key principle
Collect everything accessible in voice now, as raw events that are never deleted, so statistics nobody thought of yet can be computed retroactively. Message data was dropped from scope by the developer on 2026-11-17.

## Risks & assumptions to validate
| Assumption / risk | Impact if wrong | How to validate (prototype · measurement · user test · accepted) | Status |
|---|---|---|---|
| Bot restarts or network drops create wrong long sessions | Wrong statistics | Heartbeat table + startup reconciliation, closing at last heartbeat; unit tests with gaps | planned |
| better-sqlite3 installs on the Pi (arm64) with Node 24 | Slice blocked | Install test in the first slice; fallback `node:sqlite` | to verify |
| raspi-manager contract is met by a two-process app | Deployment friction | Run the `raspi-ready` skill in the first slice | to verify |
| OAuth `guilds` listing is enough to gate access per server | Users see wrong servers | Prototype the login and intersect with servers where the bot is present | planned |
| Friends accept being tracked | Social friction | Tell them what is collected; opt-out and deletion dropped on 2026-11-18 | accepted |
| Discord rate limits for OAuth calls are not an issue at this size | Login errors | Accepted (numeric limits not verified; handle HTTP 429 with retry) | accepted |
