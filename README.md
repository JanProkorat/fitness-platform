# Fitness Platform

[![Backend CI](https://github.com/JanProkorat/fitness-platform/actions/workflows/backend.yml/badge.svg)](https://github.com/JanProkorat/fitness-platform/actions/workflows/backend.yml)
[![Web CI](https://github.com/JanProkorat/fitness-platform/actions/workflows/web.yml/badge.svg)](https://github.com/JanProkorat/fitness-platform/actions/workflows/web.yml)

Fitness & nutrition platform connecting trainers, nutritionists, and clients.

## Monorepo Structure

```
├── backend/
│   └── FitnessPlatform.Application/   # Single-project vertical slice architecture
│       ├── Domain/                     # Entities, enums, base classes
│       ├── Infrastructure/             # EF Core, data access, external services
│       ├── Features/                   # Vertical slices (endpoints + logic)
│       └── Middleware/                 # Cross-cutting concerns
├── web/        # React + TypeScript + Vite (admin portal)
├── mobile/     # React Native (future)
└── docs/       # Documentation & plans
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20+](https://nodejs.org/)
- [Docker & Docker Compose](https://www.docker.com/)

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/JanProkorat/fitness-platform.git
cd fitness-platform

# 2. Full setup (.env, Docker, migrations, seed) — one command
make setup

# 3. Start the backend API
make backend

# 4. In another terminal, start the web portal
make web
```

## Services (Docker Compose)

| Service   | Port  | Description                      |
|-----------|-------|----------------------------------|
| PostgreSQL| 5432  | Primary relational database      |
| MongoDB   | 27017 | Document store                   |
| MinIO     | 9000  | S3-compatible blob storage       |
| MinIO UI  | 9001  | MinIO management console         |
| Adminer   | 8080  | Database management UI           |
| MailHog   | 8025  | Dev email UI (SMTP on 1025)      |

## Make Commands

| Command      | Description                          |
|--------------|--------------------------------------|
| `make dev`   | Start all Docker services            |
| `make down`  | Stop all Docker services             |
| `make backend` | Run the .NET API                   |
| `make web`   | Run the React dev server             |
| `make migrate` | Apply EF Core migrations           |
| `make test`  | Run all tests (backend + web)        |
| `make clean` | Remove Docker volumes (destructive!) |

## Branch Strategy

- `main` - production
- `develop` - integration
- `feature/*` - feature branches
