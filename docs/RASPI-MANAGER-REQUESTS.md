# Requests for raspi-manager
Gaps found while making this app deployable. Paste a section into a raspi-manager session. No private data here.

## 2026-11-17 — Scheduled job per app (nightly database backup)
- **App / commit**: Vocalog, written from the uncommitted working tree (no commit yet).
- **Need**: run one command on a schedule for an app (here a nightly SQLite backup: `sqlite3 <db> "VACUUM INTO '<backup>'"` and removal of backups older than N days). Without it the only copy of the data is the file on the Pi, and a corrupted SD card loses the whole journal, which cannot be rebuilt (Discord gives no voice history).
- **Observed behaviour today**: raspi-manager runs one run command as a systemd service per app; no timer unit or scheduled job (inferred from the contract, not from its repository).
- **Proposed behaviour**: in the app form, an optional "Scheduled jobs" list (name, command, schedule such as `daily 03:30`). GUI first, CLI twin. Generates a systemd service plus timer next to the app unit, with the same user, working folder and env files. Read-only preview of the exact unit files before applying; `--dry-run`; idempotent; the Pi is changed only by the owner through the GUI. Show last run result and time in the app screen.
- **Where it likely lives**: `core/` (unit file generation, pure), `ssh/` (apply), `services/` (job state), `gui/` (form and status). Update `WORKFLOW.md` first, then SPEC, ARCHITECTURE, DECISIONS.
- **Acceptance**: tests with fakes (form to plan to confirm to apply to message, plus a failing apply); try read-only on a real Pi: generate the preview, list timers, change nothing.
- **Out of scope**: off-site backup upload, retention policy beyond a day count. **Open questions**: should jobs share the app's env file; where backup files go (a folder listed in `requires`).

## 2026-11-17 — Two processes for one app (collector and web server) — needed later
- **App / commit**: Vocalog, same working tree. Not blocking today (only the bot is deployed).
- **Need**: the planned web server and the bot share one repository and one database but are separate long-running processes. Running them as one command (a shell wrapper) would restart both on any failure and hide which one crashed.
- **Observed behaviour today**: one build command and one run command per app (inferred from the contract).
- **Proposed behaviour**: either several run commands per app, each its own systemd unit sharing the working copy and env files, or two apps from the same repository at the same commit with a documented way to update them together. Prefer the first. Same safeguards as above (preview, dry run, idempotent, GUI first).
- **Where it likely lives**: `core/` (app model), `services/`, `gui/`. Docs first: `WORKFLOW.md`, then SPEC, ARCHITECTURE, DECISIONS.
- **Acceptance**: tests with fakes for creating, starting, stopping and updating two units; try read-only on a real Pi.
- **Out of scope**: a process manager inside the app. **Open question**: how the owner wants updates to be ordered (database migrations run by the bot at start).
