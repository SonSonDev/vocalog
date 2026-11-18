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

## 2026-11-17 — Two processes for one app (collector and web server) — DONE 2026-11-18 (`processes:` list)
- **App / commit**: Vocalog, same working tree. Not blocking today (only the bot is deployed).
- **Need**: the planned web server and the bot share one repository and one database but are separate long-running processes. Running them as one command (a shell wrapper) would restart both on any failure and hide which one crashed.
- **Observed behaviour today**: one build command and one run command per app (inferred from the contract).
- **Proposed behaviour**: either several run commands per app, each its own systemd unit sharing the working copy and env files, or two apps from the same repository at the same commit with a documented way to update them together. Prefer the first. Same safeguards as above (preview, dry run, idempotent, GUI first).
- **Where it likely lives**: `core/` (app model), `services/`, `gui/`. Docs first: `WORKFLOW.md`, then SPEC, ARCHITECTURE, DECISIONS.
- **Acceptance**: tests with fakes for creating, starting, stopping and updating two units; try read-only on a real Pi.
- **Out of scope**: a process manager inside the app. **Open question**: how the owner wants updates to be ordered (database migrations run by the bot at start).

## 2026-11-17 — Move an app, with its data, to another device — DONE 2026-11-18 (`host move-app`; app check command and route follow-up not done)
- **App / commit**: Vocalog, written from commit `b0869b3`.
- **Need**: move an app from one device to another without losing its data. For Vocalog the data is an append-only SQLite journal of voice events that cannot be rebuilt (Discord provides no voice history), so a lost or inconsistent copy is permanent loss. Without a guided move, the owner copies files by hand and risks copying a SQLite file in WAL mode while the app runs (inconsistent copy), or running two instances at once (duplicate events).
- **Observed behaviour today** in raspi-manager: an app is installed on one Pi (clone, build, unit, route). No operation to relocate an app with its data (inferred from the contract, not from its repository; check its SPEC for a planned item).
- **Proposed behaviour**: GUI first (App, Move to another device...), CLI twin.
  1. Read-only preflight: target reachable, same Node and architecture requirements, free disk space, `requires` folders and their sizes, env file keys present on the target, no instance already running there.
  2. Show the exact plan and ask for confirmation: stop on the source, copy each `requires` folder and the env file to the target, install the same commit, start, compare, then leave the source stopped.
  3. Stop the app on the source first (a clean `SIGTERM` lets this app checkpoint its database), then copy the folders. Never copy a data folder while the app runs.
  4. Verify after the copy: file sizes and checksums match; optional app-provided check command (here: `PRAGMA integrity_check` and an event count).
  5. Start on the target; keep the source unit stopped and disabled, never delete its data automatically.
  Idempotent where possible, `--dry-run`, abort and restart the source on any failure before the target is started. Pi changes only by the owner through the GUI.
- **Where it likely lives**: `core/` (plan and preflight, pure), `ssh/` (transfer, relayed through the owner's machine if the two devices cannot reach each other), `services/` (stop, copy, verify, start), `gui/` (wizard). Update `WORKFLOW.md` first, then SPEC, ARCHITECTURE, DECISIONS.
- **Acceptance**: tests with fakes: plan, confirm, stop, copy, verify, start; failure before target start restarts the source; checksum mismatch aborts; refuses when the target already runs the app. On a real Pi, try the read-only preflight only.
- **Out of scope**: live replication, moving from a development PC that is not a raspi-manager target (a one-time manual copy, with the app stopped, covers that), automatic deletion of the source data, secret transfer beyond the declared env file.
- **Open questions for the owner**: should the env file be copied or re-entered on the target (secrets); where the transfer is relayed when the two devices cannot reach each other; keep the source data for how long.
