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

If a port is already used on your machine, change it in the `.env` file and run `make restart`. Real `.env` files are ignored by Git. Only the `.env.example` files are committed.

PostgreSQL only reads `DB_USER`, `DB_PASSWORD` and `DB_NAME` when its data volume is first created. To change them later you must reset the database volume (see below).

## Everyday commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `make start` | Build if needed and start PostgreSQL, server and client |
| `make stop` | Stop and remove the containers. Database data is kept |
| `make restart` | Stop, then start. Use after changing a `.env` file or `docker-compose.yml` |
| `make logs` | Follow the logs of all services (Ctrl+C leaves them running) |
| `make ps` | Show container status |
| `make db` | Start only the database |
| `make rebuild` | Use after adding or removing a package. Recreates the `node_modules` volumes and rebuilds |

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
make rebuild
```

`make restart` is not enough. The containers keep their own `node_modules` in Docker volumes, and those are only refreshed by `make rebuild`. The database volume is never touched by it.

## Database

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

## Notes

- `docker-compose.yml`, the `Dockerfile.dev` files and these commands are for local development only. Production needs its own Dockerfiles and environment configuration.
- Each of `client/` and `server/` owns its own `package.json`, lockfile and `.env`.
