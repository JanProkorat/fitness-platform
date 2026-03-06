# Fitness Platform - CLAUDE.md

## Project Overview

Fitness & nutrition platform connecting trainers, nutritionists, and clients.
Monorepo with ASP.NET Core 10 backend, React + TypeScript web portal, and future React Native mobile app.

## Architecture

### Backend - Vertical Slice Architecture

Single project: `backend/FitnessPlatform.Application/`

```
FitnessPlatform.Application/
├── Domain/
│   ├── Common/          # BaseEntity, TimestampableEntity, PublicTimestampableEntity
│   ├── Entities/        # All EF Core entities
│   ├── Enums/           # UserRole, etc.
│   └── Interfaces/      # Domain contracts
├── Infrastructure/
│   ├── Data/            # ApplicationDbContext, migrations, configurations, seed
│   └── Services/        # External service integrations (email, blob storage)
├── Features/            # Vertical slices grouped by domain area
│   ├── Auth/            # Login, Register, RefreshToken, Logout, PasswordReset
│   ├── Users/           # GetProfile, UpdateProfile
│   └── Trainers/        # GetClients, InviteClient
├── Middleware/           # GlobalExceptionHandler, etc.
├── Program.cs           # Composition root
└── appsettings.json     # Configuration (never commit secrets)
```

### Web - React + TypeScript + Vite

```
web/
├── src/
│   ├── components/
│   ├── pages/
│   └── ...
```

## Key Conventions

### Entity Base Classes

Every database entity MUST inherit from the appropriate base class:

- `BaseEntity` - internal `long Id` primary key only
- `TimestampableEntity` : BaseEntity - adds `DateCreated`, `DateUpdated` (auto-set by DbContext)
- `PublicTimestampableEntity` : TimestampableEntity - adds `Guid PublicId` (auto-generated, unique index)

Use `PublicTimestampableEntity` for all entities exposed via API. Use `TimestampableEntity` for internal-only entities (e.g., RefreshToken). Use `BaseEntity` for log/audit tables.

`ApplicationUser` extends `IdentityUser<Guid>` directly (not base entities) but includes DateCreated/DateUpdated manually.

### Vertical Slices (Features)

Each feature is a self-contained folder under `Features/`:
```
Features/Auth/Login/
├── LoginEndpoint.cs     # FastEndpoints endpoint
├── LoginRequest.cs      # Request DTO
├── LoginResponse.cs     # Response DTO
└── LoginValidator.cs    # FluentValidation validator (optional)
```

### FastEndpoints

- Use `Endpoint<TRequest, TResponse>` or `EndpointWithoutRequest<TResponse>`
- Configure route, HTTP method, auth in `Configure()` override
- Business logic in `HandleAsync()` override
- Validators use FluentValidation and are auto-wired

### XML Documentation

Every class, property, method, and interface MUST have XML doc comments (`///`).
Use `<inheritdoc />` for interface implementations and overrides where appropriate.

### Database

- PostgreSQL via EF Core (Npgsql) for relational data
- MongoDB for document storage (exercise videos, complex nested data)
- MinIO (S3-compatible) for blob storage (photos, files)
- Migrations: `dotnet ef migrations add <Name> --project FitnessPlatform.Application --output-dir Infrastructure/Data/Migrations`

### API IDs

- Internal: `long Id` (never exposed in API)
- External: `Guid PublicId` (used in all API requests/responses)

### Authentication

- JWT Bearer tokens via FastEndpoints.Security
- Access token: 15 minutes
- Refresh token: 7 days, stored in PostgreSQL, rotation on use
- Roles: Admin, Trainer, Nutritionist, Client

### Security (GDPR)

- Health data = GDPR Art. 9 special category
- Explicit consent required and recorded (GdprConsent + GdprConsentDate)
- AuditLog table tracks access to sensitive data
- Never commit .env files with real credentials
- CORS restricted to specific origins (no wildcard)
- Rate limiting on auth endpoints: 10 req / 15 min per IP

## Commands

```bash
# Docker
make dev              # Start PostgreSQL, MongoDB, MinIO, Adminer, MailHog
make down             # Stop all services
make clean            # Remove volumes (destructive)

# Backend
make backend          # Run API (https://localhost:5001, Swagger at /swagger)
make migrate          # Apply EF Core migrations
make seed             # Seed roles

# Web
make web              # Dev server at http://localhost:5173

# Testing
make test             # Run all tests
```

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Backend    | ASP.NET Core 10, FastEndpoints, EF Core 10    |
| Auth       | ASP.NET Identity, JWT Bearer, FastEndpoints.Security |
| Validation | FluentValidation                              |
| Database   | PostgreSQL 16, MongoDB 7                      |
| Blob Store | MinIO (dev), Azure Blob Storage (prod)        |
| Web        | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| Logging    | Serilog                                       |
| CI/CD      | GitHub Actions                                |
| Hosting    | Azure App Service (prod), Docker Compose (dev)|
