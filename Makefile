.PHONY: dev up down db-init db-reset logs ps

## Start all services in development mode
dev:
	npm run dev

## Start Docker services (DB + Redis)
up:
	npm run docker:up
	@echo "Waiting for postgres to be ready..."
	@sleep 3

## Stop Docker services
down:
	npm run docker:down

## Initialize database schema
db-init:
	docker exec -i dgr_postgres psql -U dgr_user -d dgr_platform < infrastructure/postgres/init.sql
	@echo "✅ Database initialized"

## Reset database (WARNING: deletes all data)
db-reset:
	docker exec -i dgr_postgres psql -U dgr_user -d dgr_platform -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker exec -i dgr_postgres psql -U dgr_user -d dgr_platform < infrastructure/postgres/init.sql
	@echo "✅ Database reset complete"

## View Docker logs
logs:
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f

## Show running containers
ps:
	docker-compose -f infrastructure/docker/docker-compose.yml ps

## Install all dependencies
install:
	npm run install:all

## First time full setup
setup: install up
	@sleep 5
	@$(MAKE) db-init
	@echo ""
	@echo "✅ DGR Platform ready!"
	@echo "   Run: npm run dev"
	@echo "   API: http://localhost:3000"
