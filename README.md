# Vocalog

A Discord bot that records voice-channel activity into a permanent event journal (SQLite), and a web dashboard (planned) that turns it into statistics. See `docs/BRIEF.md` and `docs/SPEC.md`.

Status: the collector (`bot/`) works and is deployed. The dashboard (`server/`, `web/`) is built for local use only: Discord login is not built yet, so the server refuses to start without `INSECURE_NO_AUTH=1` and must **not** be deployed or exposed.

## Development
- `npm ci`, then `npm test` and `npm run typecheck`.
- Local run: copy `.env.example` to `.env`, fill it in, then `node --env-file=.env bot/src/index.ts`.
- TypeScript runs directly on Node (native type stripping, Node >= 24); there is no build step for the bot.

## Deployment (raspi-manager)

Currently deployable: the bot only.

- **Build:** `npm ci`. If it fails while compiling `better-sqlite3` (no C++ toolchain on the machine), use `npm ci --ignore-scripts` instead: the package ships prebuilt binaries (linux-arm64, linux-x64, win32-x64 and others) and never needs to compile.
- **Run:** `node bot/src/index.ts`
- **Runtime:** Node 24 (`.nvmrc`, `engines.node >= 24`). It must support native type stripping. The native module `better-sqlite3` must install on Debian arm64: check with `npm ci` on the Pi first.
- **Port:** none (the bot only opens an outgoing connection to Discord).
- **Env file:** loaded by systemd (`EnvironmentFile`), not by the app. A changed value needs "Push and restart".

| Key | Required | Meaning |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token from the Discord developer portal. Secret: never commit, never log. |
| `ALLOWED_GUILD_IDS` | yes | Comma-separated ids of the servers to record. Nothing is recorded outside this list. |
| `DB_PATH` | yes | Absolute path of the SQLite file, outside the application folder. |

The bot exits with a non-zero status and a message naming the missing key when a variable is missing or invalid. It never prints values.

- **Data:** the SQLite file lives at `DB_PATH` (WAL mode: `-wal` and `-shm` files sit next to it). Updates and rollbacks replace the application folder, so keep the data elsewhere, for example `~/data/vocalog/`.
- **`requires` line for raspi-manager:** `folder|/home/<user>/data/vocalog` (use the real absolute path).
- **Database migrations** run at start (`db/migrations`, numbered, applied once). A migration must stay compatible with the previous commit, or a rollback needs a restore of the database file. Migration 002 only adds tables and columns, so rolling back to the previous commit keeps working.
- **Backups:** the nightly `VACUUM INTO` backup is not available through raspi-manager yet; see `docs/RASPI-MANAGER-REQUESTS.md`. Until then, copy the database file while the bot is stopped, or use `sqlite3 <db> "VACUUM INTO '<backup>'"`.

### Steps for the owner
1. Create the GitHub repository and push this project (nothing from `.env` or `data/` is tracked).
2. In raspi-manager: App, New app: name, repository `OWNER/NAME`, build `npm ci`, run `node bot/src/index.ts`, folder `~/apps/vocalog`, env file path, the `requires` line above.
3. Put the real values in the env file on the Pi, then start the app and check the logs for `Ready as ...`.
4. The development bot on the PC and the Pi bot must not run at the same time with the same token and the same database (duplicate events).
