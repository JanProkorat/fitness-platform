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

## Automated security review

Every push and PR targeting `develop` or `main` is scanned by
[GitHub CodeQL](https://codeql.github.com/) (`.github/workflows/codeql.yml`),
plus a weekly full scan. CodeQL is GitHub's static-analysis (SAST) engine; it
analyzes both the C# backend and the JavaScript/TypeScript web + mobile code
for known vulnerability patterns — injection, unsafe deserialization, path
traversal, hardcoded-credential flows, and similar. It is **free for public
repositories** and needs no API key. This backstops the manual `gc-sec-review`
skill; it does not replace it.

Analysis runs in CodeQL **`build-mode: none`** (buildless) for both languages,
so the job needs no .NET SDK or npm install and can't break on an unrelated
build error.

**How to read the findings**

- Findings surface in the repo's **Security → Code scanning alerts** tab (not
  as PR comments). On a PR, new alerts introduced by the diff also appear as
  annotations in the PR's **Checks** tab.
- The scan is **advisory** — the CodeQL check is *not* a required status
  check, so an alert does **not** block merge. Treat alerts as a prompt to
  triage, not an automatic veto.
- **Triage each alert:** open it in the Security tab, follow the data-flow
  path CodeQL shows, and either fix it or dismiss it with a reason
  (`False positive` / `Used in tests` / `Won't fix`). Dismissals are
  remembered so the same alert doesn't resurface.
- High-severity alerts on auth, invite, ownership, or upload surfaces should
  be fixed in the same PR. Lower-severity findings can become a follow-up
  issue.

**Setup / notes**

- **No secret or API key required** — CodeQL runs on GitHub-hosted runners
  against the public repo. Code scanning must be enabled for the repo
  (Settings → Code security → Code scanning); the workflow itself provides the
  analysis.
- The workflow needs `security-events: write` permission to upload results —
  already set in the workflow's least-privilege `permissions` block.
- To make it a hard gate instead of advisory, add the CodeQL check to the
  branch-protection required checks, or configure code-scanning merge
  protection rules in repo settings.
- The query suite can be widened (e.g. `security-extended`) via a
  `queries:` input on the `init` step if deeper coverage is wanted later.
