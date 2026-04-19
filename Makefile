.PHONY: dev down backend web migrate seed test clean setup generate-api

# Secrets consumed by Program.cs at host-build time. `dotnet run` picks these up
# from launchSettings.json automatically, but `dotnet ef` does not — so any
# target that invokes the EF design-time tooling must pass them explicitly.
# Values mirror the `https` profile in
# backend/FitnessPlatform.Application/Properties/launchSettings.json.
DEV_ENV := ASPNETCORE_ENVIRONMENT=Development \
	POSTGRES_PASSWORD=fitness_dev_password \
	MONGO_PASSWORD=mongo_dev_password \
	MINIO_ACCESS_KEY=minioadmin \
	MINIO_SECRET_KEY=minio_dev_password \
	JWT_SECRET='super-secret-jwt-key-change-in-production-min-32-chars!!'

# Start all Docker services
dev:
	docker compose up -d

# Stop all Docker services
down:
	docker compose down

# Run backend API
backend:
	cd backend/FitnessPlatform.Application && ASPNETCORE_ENVIRONMENT=Development dotnet run

# Run web dev server
web:
	cd web && npm run dev

# Run EF Core migrations
migrate:
	cd backend && $(DEV_ENV) dotnet ef database update --project FitnessPlatform.Application

# Seed the database
seed:
	cd backend/FitnessPlatform.Application && ASPNETCORE_ENVIRONMENT=Development dotnet run -- --seed

# Run all tests
test:
	cd backend && dotnet test
	cd web && npm test

# Generate TypeScript API client from backend OpenAPI spec (backend must be running)
generate-api:
	cd backend && curl -sk https://localhost:5001/swagger/v1/swagger.json -o swagger.json && dotnet nswag run nswag.json
	sed -i '' 's|/\* eslint-disable \*/|/* eslint-disable */\n// @ts-nocheck|' web/src/api/generated.ts

# Remove Docker volumes (destructive!)
clean:
	docker compose down -v

# Full infrastructure setup: .env, Docker, migrations, seed
setup:
	@echo "==> Creating .env from .env.example (if not exists)..."
	@test -f .env || cp .env.example .env
	@echo "==> Starting Docker containers..."
	docker compose up -d
	@echo "==> Waiting for PostgreSQL to be ready..."
	@until docker exec fitness-postgres pg_isready -U fitness_admin -d fitness_dev > /dev/null 2>&1; do sleep 1; done
	@echo "==> Applying EF Core migrations..."
	cd backend && $(DEV_ENV) dotnet ef database update --project FitnessPlatform.Application
	@echo "==> Seeding database (roles)..."
	cd backend/FitnessPlatform.Application && ASPNETCORE_ENVIRONMENT=Development dotnet run -- --seed
	@echo "==> Setup complete!"
	@echo ""
	@echo "Services:"
	@echo "  API:       make backend (http://localhost:5000)"
	@echo "  Adminer:   http://localhost:8080"
	@echo "  MinIO:     http://localhost:9001"
	@echo "  MailHog:   http://localhost:8025"
