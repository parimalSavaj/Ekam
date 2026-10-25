# Ekam local development. Run from the repo root.
#   make start   PostgreSQL + server + client, all in Docker
#   make stop    stop and remove the containers (database data is kept)
# Settings come from server/.env and client/.env (copy each .env.example).

COMPOSE = docker compose --env-file server/.env --env-file client/.env
COMPOSE_DOWN = docker compose --profile "*" --env-file server/.env --env-file client/.env

.PHONY: start stop restart rebuild logs ps db migration migrate migration-status

# Build images if needed, start everything in the background, and wait until
# the database and the server report healthy (fails if the server does not come up)
start:
	$(COMPOSE) up -d --build --wait

# Stop everything; data stays in the ekam_pgdata volume.
# --profile "*" also covers the db service (local-db profile), which down would
# otherwise skip and leave running, keeping the network in use.
stop:
	$(COMPOSE_DOWN) down

restart: stop start

# Use after changing package.json / package-lock.json in client or server.
# Rebuilds the images and recreates the node_modules / .next volumes.
# The database volume (ekam_pgdata) is not touched.
rebuild:
	$(COMPOSE_DOWN) down
	-docker volume rm ekam_server_node_modules ekam_client_node_modules ekam_client_next
	$(COMPOSE) up -d --build --wait

# Follow logs of all services (Ctrl+C leaves them running)
logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# Database only
db:
	$(COMPOSE) up -d db

# Generate a server-owned SQL file without starting the API or database.
# Example: make migration name=create-auth-tables
migration:
	$(if $(name),,$(error Usage: make migration name=create-auth-tables))
	$(COMPOSE) run --rm --no-deps migrate npm run db:create-migration -- "$(name)"

# Run in a temporary container; works even while the API is stopped.
migrate:
	$(COMPOSE) run --rm migrate

migration-status:
	$(COMPOSE) run --rm migrate npm run db:status
