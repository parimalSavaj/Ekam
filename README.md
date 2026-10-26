# Ekam

This repository runs the Ekam client, server and PostgreSQL database together with Docker for local development.

| Folder | What it is |
| --- | --- |
| `client/` | Next.js frontend (its own repo, git submodule) |
| `server/` | Express + TypeScript API (its own repo, git submodule) |

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- `make`. On Windows: `winget install ezwinports.make`, then open a new terminal.
- Git, with submodules: `git clone --recurse-submodules <repo-url>` (or `git submodule update --init` after cloning).

Node.js is not needed to run the stack, because the apps run inside Docker. You only need it on your machine to run `npm install` for new packages.

## First-time setup

Create the two env files from their examples and fill in the values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

PowerShell: `Copy-Item server\.env.example server\.env` (same for `client`).

| File | Variable | Meaning |
| --- | --- | --- |
| `server/.env` | `PORT` | Port of the API on your machine |
| `server/.env` | `DB_PORT` | Port of PostgreSQL on your machine |
| `server/.env` | `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credentials PostgreSQL is created with |
| `server/.env` | `HOST`, `NODE_ENV` | Server settings. `HOST` is overridden inside Docker |
| `server/.env` | `DB_HOST` | Database host for running the server outside Docker. Overridden inside Docker |
| `server/.env` | `COMPOSE_PROFILES` | Set to `local-db` to start the local PostgreSQL container. Leave it out when using `DATABASE_URL` |
| `server/.env` | `DATABASE_URL` | Hosted database (for example Neon in production). Use it instead of the five `DB_*` values, never together with them. Production requires `sslmode=require` or stronger in the URL |
| `client/.env` | `CLIENT_PORT` | Port of the client on your machine |
| `server/.env` | `BETTER_AUTH_URL`, `CLIENT_URL` | Browser-facing server and frontend origins; use `http://localhost:5000` and `http://localhost:3000` locally |
| `server/.env` | `BETTER_AUTH_SECRET` | Random secret of at least 32 characters; keep stable between restarts |
| `server/.env` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Web application OAuth credentials; server only |
| `server/.env` | `MIGRATION_DATABASE_URL` | Optional direct/session-pooled connection for migrations; needed when the runtime URL uses transaction pooling |
| `client/.env` | `NEXT_PUBLIC_AUTH_URL` | Public API origin, locally `http://localhost:5000`; never a Docker service hostname |

If a port is already used on your machine, change it in the `.env` file and run `make restart`. Real `.env` files are ignored by Git. Only the `.env.example` files are committed.

PostgreSQL only reads `DB_USER`, `DB_PASSWORD` and `DB_NAME` when its data volume is first created. To change them later you must reset the database volume (see below).

## Everyday commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `make start` | Build, apply pending migrations, then start healthy server and client |
| `make stop` | Stop and remove the containers. Database data is kept |
| `make restart` | Stop, then start. Use after changing a `.env` file or `docker-compose.yml` |
| `make logs` | Follow the logs of all services (Ctrl+C leaves them running) |
| `make ps` | Show container status |
| `make db` | Start only the database |
| `make rebuild` | Force a clean dependency-volume rebuild; database data is kept |
| `make migration name=create-auth-tables` | Create a timestamped SQL file in `server/migrations/` |
| `make migrate` | Apply pending migrations in a temporary server container |
| `make migration-status` | Show applied and pending migrations |

After `make start`:

- Client: `http://localhost:<CLIENT_PORT>` (default 3000)
- Server: `http://localhost:<PORT>` (default 5000)
- PostgreSQL: `localhost:<DB_PORT>`

All ports are bound to `127.0.0.1`, so they are only reachable from your own machine.

## Editing code

Saving a file in `client/` or `server/` updates the running app automatically. The containers watch for changes by polling, because Windows file events do not reach Docker, so a reload can take up to about a second.

## Adding a package

```bash
cd server        # or client
npm install some-package
cd ..
make start
```

The containers refresh their dependency volumes automatically when `package-lock.json` changes. `make rebuild` remains available for a clean dependency-volume reset. Neither operation deletes the database volume.

## Database

SQL migrations belong to `server/migrations/`; the root Makefile forwards commands into Docker. Startup order is local PostgreSQL healthy → one-shot `migrate` service exits successfully → API healthy → client healthy. A failed migration blocks API startup. Hosted databases skip the local PostgreSQL service and use the configured URL.

The migration runner uses one transaction per file, a PostgreSQL advisory lock, and `schema_migrations(filename, checksum, applied_at)`. It runs only pending files and refuses changed or missing applied files. Applied migrations are append-only. Use a direct/session-pooled `MIGRATION_DATABASE_URL` when the runtime connection uses transaction pooling, because the lock is session-scoped.

To change the schema: run `make migration name=describe-your-change`, edit the generated SQL, then `make migrate`. Use `make migration-status` to inspect the result. Existing legacy data is not imported by these schema migrations.

Connect with any PostgreSQL client (for example DBeaver) using host `localhost`, port `DB_PORT`, and the `DB_USER`, `DB_PASSWORD` and `DB_NAME` from `server/.env`.

Data lives in the Docker volume `ekam_ekam_pgdata` and survives `make stop`. To wipe it and start with an empty database (this deletes all data):

```bash
docker compose --env-file server/.env --env-file client/.env down
docker volume rm ekam_ekam_pgdata
make start
```

### DBeaver: `invalid value for parameter "TimeZone": "Asia/Calcutta"`

Java reports India's timezone under an old name that recent PostgreSQL images reject. Add this line at the end of `dbeaver.ini` (below `-vmargs`), then fully restart DBeaver:

```
-Duser.timezone=Asia/Kolkata
```

## Google login

- Open `http://localhost:3000/login` and choose **Login with Google**. First login creates the Ekam identity automatically; there is no separate registration UI, password login, password recovery or email service.
- Register `http://localhost:5000/api/auth/callback/google` on your Google Web OAuth client. Keep `localhost` consistent rather than mixing it with `127.0.0.1` in browser-facing URLs. Add test users to the Google consent configuration if your app is in testing mode.
- Account settings at `/account` support display-name editing, session listing/revocation, logout and deletion after recent Google login. The platform uses a left sidebar without a top header. Notebooks are a future feature.
- Authentication is self-hosted inside Express; no Better Auth hosted account is needed. The four auth tables are `users`, `accounts`, `sessions`, and `verifications`. Google tokens are encrypted at rest; browser authentication uses a separate HttpOnly session cookie.
- The client hides protected screens until its session resolves; APIs must independently enforce sessions using `AuthMiddleware.requireSession()`.
- Production requires HTTPS and an explicit same-site browser deployment (for example `app.example.com` and `api.example.com`). This local Compose setup is not a production deployment. Unrelated frontend/API domains need additional cookie/proxy design.

## Workspaces

Signed-in users manage workspaces at `/workspaces`: create, list, rename and delete. A workspace belongs to the user who created it, other users cannot see or change it, and deleting an account deletes its workspaces. The API is under `/api/workspaces` (see `server/README.md`). It needs the `create-workspaces-table` migration, so run `make start` or `make migrate` after pulling.

## Notes

- `docker-compose.yml`, the `Dockerfile.dev` files and these commands are for local development only. Production needs its own Dockerfiles and environment configuration.
- Each of `client/` and `server/` owns its own `package.json`, lockfile and `.env`.
