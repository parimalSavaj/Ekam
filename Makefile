# Ekam local development. Run from the repo root.
#   make start   PostgreSQL + server + client, all in Docker
#   make stop    stop and remove the containers (database data is kept)
# Settings come from server/.env and client/.env (copy each .env.example).

COMPOSE = docker compose --env-file server/.env --env-file client/.env

.PHONY: start stop restart rebuild logs ps db

# Build images if needed and start everything in the background
start:
	$(COMPOSE) up -d --build

# Stop everything; data stays in the ekam_pgdata volume
stop:
	$(COMPOSE) down

restart: stop start

# Use after changing package.json / package-lock.json in client or server.
# Rebuilds the images and recreates the node_modules / .next volumes.
# The database volume (ekam_pgdata) is not touched.
rebuild:
	$(COMPOSE) down
	-docker volume rm ekam_server_node_modules ekam_client_node_modules ekam_client_next
	$(COMPOSE) up -d --build

# Follow logs of all services (Ctrl+C leaves them running)
logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# Database only
db:
	$(COMPOSE) up -d db
