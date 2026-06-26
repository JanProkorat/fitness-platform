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

Every PR targeting `develop` or `main` runs the
[`anthropics/claude-code-security-review`](https://github.com/anthropics/claude-code-security-review)
GitHub Action (`.github/workflows/security-review.yml`). It uses Claude to
review **only the files changed in the PR diff** and looks for the kinds of
issues SAST tools miss — missing authorization checks, business-logic flaws,
unsafe blob/upload handling, secret leakage, and attack-path chaining. This
backstops the manual `gc-sec-review` skill; it does not replace it.

**How to read the findings**

- Findings appear as **review comments on the PR**. Each one names a file,
  line, severity, and a suggested remediation.
- The scan is **advisory** — the `Security Review` check is *not* a required
  status check, so a finding (or a red check) does **not** block merge. Treat
  the comments as a prompt to think, not an automatic veto.
- **Triage each finding before acting:** the reviewer is diff-aware but lacks
  full repo context, so it can flag false positives (e.g. a check that exists
  in a caller it can't see). Confirm the issue against the real code path
  before changing anything; resolve/dismiss the comment with a one-line reason
  if it's a false positive.
- High-severity findings on auth, invite, ownership, or upload surfaces should
  be fixed in the same PR. Lower-severity or stylistic findings can become a
  follow-up issue.

**Setup / cost notes**

- The Action requires the **`ANTHROPIC_API_KEY`** repo secret
  (Settings → Secrets and variables → Actions). Without it the job runs but
  produces no findings — it fails quietly rather than erroring.
- Each PR scan incurs Anthropic API cost. If that becomes a concern, scope the
  workflow down (e.g. a diff-size filter, or run only on `develop`-targeted
  PRs) — see the comments at the top of the workflow file.
- **Public repo / fork PRs:** the Action is not hardened against prompt
  injection and should only review trusted PRs. The workflow uses the safe
  `pull_request` trigger (not `pull_request_target`), so fork PRs run with a
  read-only token and do **not** receive the `ANTHROPIC_API_KEY` secret by
  default. Keep "Require approval for all external contributors" enabled under
  Settings → Actions → General so a fork PR's diff is never scanned without a
  maintainer's go-ahead.
- To make it a hard gate instead of advisory, add `Security Review` to the
  branch-protection required checks and/or configure a severity threshold in
  the workflow step.
