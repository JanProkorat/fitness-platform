.PHONY: dev down backend web migrate seed test clean setup

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
	cd backend && dotnet ef database update --project FitnessPlatform.Application

# Seed the database
seed:
	cd backend/FitnessPlatform.Application && ASPNETCORE_ENVIRONMENT=Development dotnet run -- --seed

# Run all tests
test:
	cd backend && dotnet test
	cd web && npm test

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
	cd backend && dotnet ef database update --project FitnessPlatform.Application
	@echo "==> Seeding database (roles)..."
	cd backend/FitnessPlatform.Application && ASPNETCORE_ENVIRONMENT=Development dotnet run -- --seed
	@echo "==> Setup complete!"
	@echo ""
	@echo "Services:"
	@echo "  API:       make backend (http://localhost:5000)"
	@echo "  Adminer:   http://localhost:8080"
	@echo "  MinIO:     http://localhost:9001"
	@echo "  MailHog:   http://localhost:8025"
