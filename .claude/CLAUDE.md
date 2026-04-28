# GoodFellas — Orchestration & Sub-agent Routing

This file supplements the root `CLAUDE.md`. It tells the main (orchestrator)
Claude how to route work to specialist sub-agents so each package's conventions
are applied consistently.

## Sub-agents

Project-local dev agents (live in `.claude/agents/`):

| Agent              | Use when work primarily touches…                                |
|--------------------|-----------------------------------------------------------------|
| `backend-dotnet`   | `/backend/**` — ASP.NET Core 10, FastEndpoints, EF/Mongo, SignalR |
| `web-react`        | `/web/**` — React 19, Vite, shadcn, TanStack Query, RHF + Zod   |
| `mobile-expo`      | `/mobile/**` — React Native, Expo Router, Zustand, design tokens |

Project-local workflow agents (live in `.claude/agents/` alongside the dev agents):

| Agent              | Role                                                            |
|--------------------|-----------------------------------------------------------------|
| `github-issues`    | GitHub issue lifecycle (create, edit, label, triage, close). Not for PRs or code. |
| `qa-tester`        | Verify a GitHub issue's ✅ Acceptance criteria after dev agents finish. Read-only at the source-tree level — uses the docker-compose harness (`npm run e2e:up`, packaged backend + deterministic seeded fixture on `:5101`) for backend curl probes + the iOS-Simulator path; boots ad-hoc `dotnet run` on `:5001` only when web smoke needs the Vite proxy. Boots Vite and Expo web as needed, runs the full test / typecheck / build surface, drives the web portal and `react-native-web` renders through the Playwright MCP plugin (https://claude.com/plugins/playwright) for AC flows and prototype-fidelity diffs, and returns PASS / PARTIAL / FAIL with evidence. Drives an iOS Simulator via XcodeBuildMCP (https://www.xcodebuildmcp.com/) for native-only ACs (MMKV, haptics, camera, native nav transitions, platform pickers); falls back to asking the user for a screenshot only if XcodeBuildMCP is unavailable. |
| `pr-reviewer`      | Runs after `qa-tester` PASS. Creates/updates the PR (against the **base** the orchestrator passes — `develop` for standalone work or epic-level PRs, the **epic branch** for sub-issue PRs), then runs a **two-pass review**: (1) a first-pass self-review (the "author's own last look" — invokes the `review` skill, applies the project's hard-rule gate, short-circuits back to the dev agents if BLOCKING findings exist); (2) only once the self-review is clean, delegates a second pass to a fresh-eyes sub-reviewer via the `Agent` tool — the sub-reviewer reviews the PR blind, with no orchestrator context beyond the PR body + diff. Both passes must be clean for a "ready for merge" verdict; either dirty returns a scope-tagged fix list. Also performs the final merge with the strategy dictated by the PR's `type:*` label — `--squash --delete-branch` for feature/bug/refactor, `--rebase --delete-branch` for docs/chore. **Sub-issue PRs (base = epic branch) auto-merge after READY FOR MERGE without per-PR user authorization** — they only land on the epic branch, not on `develop`. **Epic PRs and standalone PRs (base = `develop`) require explicit same-turn authorization.** Never force-pushes, never merges excluded PRs (see rule 8). |

## Project conventions (read by the workflow agents)

The workflow agents (`qa-tester`, `pr-reviewer`, `github-issues`) are
written to be portable in shape but read this section for the
fitness-platform-specific values they need. Keep it in sync with the
rest of the file.

**Repo & working tree**
- GitHub: `JanProkorat/fitness-platform`
- Local path: `/Users/jan/Projects/fitness-platform`
- Active base branch: `develop` (release branch: `main`)

**Label taxonomy**
- `type:*` — `feature`, `bug`, `refactor`, `docs`, `chore`
- `scope:*` — `backend`, `web`, `mobile`, `docs-infra`
- `priority:*` — `p1`, `p2`, `p3`
- `status:*` — `needs-triage`, `blocked`, `in-progress`
- Extra — `duplicate`, `help wanted`, `invalid`, `wontfix`, `good-first-issue`

**Scope → dev-agent mapping (for routing fixes)**
| `scope:*` label | Dev agent        | Folder            |
|-----------------|------------------|-------------------|
| `backend`       | `backend-dotnet` | `/backend/**`     |
| `web`           | `web-react`      | `/web/**`         |
| `mobile`        | `mobile-expo`    | `/mobile/**`      |
| `docs-infra`    | (orchestrator)   | `/docs/**`, `.github/**`, root configs |

**Branch & PR conventions** — see the dedicated section below for the
full rules and examples. Format: `<type>/<issue-number>-<short-kebab>`.

**Merge strategy mapping** — see routing rule 8 for the full logic.
- `type:feature` / `type:bug` / `type:refactor` → `--squash --delete-branch`
- `type:docs` / `type:chore` → `--rebase --delete-branch`

**Merge exclusion list** (human-only, `pr-reviewer` refuses these)
- Base branch = `main`
- Diff touches `backend/**/Migrations/**` (EF Core migrations)
- Diff touches MongoDB data-mutation scripts (bulk fix-ups, seed
  overrides, reprocessing jobs under `backend/**/Scripts/` or
  `backend/**/DataMigrations/`, or contains `db.*.update`, `bulkWrite`,
  `deleteMany` calls in the MongoContext / Services layer)
- Per-turn user opt-out: "I'll merge this one myself"

**Auto-generated files (write-locked)**
- `web/src/api/generated.ts` — regenerate via the `regen-api` skill
- `mobile/src/api/generated.ts` — regenerate via the `regen-api` skill

Any diff that hand-edits these paths is an automatic blocking finding
for `pr-reviewer`. A PreToolUse hook also blocks direct edits locally.

**Hardcoded-value bans**
- Colors, spacing, font sizes in `/web` and `/mobile` — must come from
  design tokens (`useTheme()` in mobile, Tailwind tokens in web). Brand
  accent: `#c9a84c` (gold) — never inline; use the theme entry.
- API URLs — always from env/config, never hardcoded.
- TypeScript `any` in `/web` or `/mobile` — always resolve the type.

**i18n languages supported**
- `cs` (Czech, primary), `en`, `de`. New user-facing copy must land in
  all three; missing keys are a `qa-tester` AC failure.

**Prototype locations** (design-fidelity checks)
- Mobile app → `docs/prototypes/mobile/scenes/*.html`
- Trainer portal → `docs/prototypes/trainer/scenes/*.html`
- Notion portal → `docs/prototypes/notion/scenes/*.html`
- Top-level `docs/*.html` artifacts are generated — always read the
  per-scene source.

**Verification surfaces per scope**
| Scope          | Commands                                                         |
|----------------|------------------------------------------------------------------|
| `backend`      | `dotnet build` + `dotnet test` (Testcontainers — Docker required). Two parallel runtime surfaces: **interactive dev API** at `https://localhost:5001` (owned by `dotnet run`, used by the Vite proxy for web smoke) and the **compose harness** at `https://localhost:5101` (`npm run e2e:up` — packaged backend + seeded fixture, see `docs/testing/e2e-fixtures.md`, used for direct curl probes and the iOS-Simulator dev-client). Both can run simultaneously. |
| `web`          | `npm ci` (when lockfile changes) + `npm run build`. For interactive AC checks `qa-tester` boots `npm run dev` on `:5173` and drives the touched routes through the Playwright MCP plugin (requires backend up, see above). |
| `mobile`       | `npm ci` (when lockfile changes) + `npx tsc --noEmit` + `npx expo prebuild --no-install --check`. For interactive AC checks `qa-tester` boots `npx expo start --web` and drives the `react-native-web` render through Playwright + iOS Simulator via XcodeBuildMCP for native-only ACs (MMKV, haptics, camera, native nav transitions, platform pickers). Dev-client `.app` produced by `mobile/scripts/qa-build-dev-client.sh` (sha-cached). |
| `docs-infra`   | File diff, workflow dry-run where possible                       |

**Review skill**
- Invoke as `Skill: review` against the PR URL/number — this is the
  project's code-review flow used by `pr-reviewer`.

## Epic-branch model (two-tier integration)

Epics — issues that enumerate sub-issues in their body — do **not** ship
their children one-by-one into `develop`. They ship as one consolidated
unit. This protects `develop` from a half-shipped epic state where one
sub-issue has merged and the next is still in flight.

The model is a two-tier branch hierarchy:

```
main
 └── develop                   ← release-stable; only complete epics merge in
      └── feature/<E>-<short>  ← THE EPIC BRANCH (one per epic issue)
           ├── feature/<C1>-<short>   ← sub-issue branches off the EPIC branch
           ├── fix/<C2>-<short>
           └── refactor/<C3>-<short>
```

**Definitions**
- **Epic issue** — a GitHub issue whose body contains a checklist of
  child-issue references (`- [ ] #123 — title`) OR child issues that
  back-reference it via "Part of #N" / "Parent: #N". Detection: any
  parent issue with ≥1 sub-issue.
- **Epic branch** — `feature/<epic-N>-<short-kebab>`, branched off
  `develop`. Created the moment epic work starts. Lives until the
  epic's consolidated PR merges to `develop`.
- **Sub-issue branch** — `<type>/<child-N>-<short-kebab>` where
  `<type>` matches the child's `type:*` label. Branched off the
  **epic branch**, not `develop`. PR base = the epic branch.
- **Standalone issue** — an issue with no parent epic. Continues to
  branch off `develop` directly with PR base = `develop`. The
  epic-branch model does not apply.

**Branch & merge flow**

1. Epic kickoff: orchestrator creates and pushes the epic branch off
   the latest `develop`. No code yet — just a tracking branch.
2. Each sub-issue is dispatched to its dev sub-agent. The dev agent
   creates its branch off the **epic branch** (not `develop`) and
   does its work there. Concurrent sub-issues use `git worktree`
   rooted at `.worktrees/<child-N>-<short>/` based on
   `origin/<epic-branch>`.
3. Sub-issue PR opens against the **epic branch**. `qa-tester` runs
   per the AC gate (rule 6). `pr-reviewer` runs per the code-review
   gate (rule 7). On READY FOR MERGE, the sub-issue PR
   **auto-merges into the epic branch** without per-PR user
   authorization — see rule 8a. Strategy still follows the `type:*`
   label.
4. After a sub-issue merges to the epic branch, the orchestrator
   rebases any in-flight sibling sub-issue branches onto the new
   epic-branch tip before letting their PRs proceed (otherwise the
   diffs go stale).
5. When every sub-issue the user wants in the epic has merged into
   the epic branch, the orchestrator opens an **epic PR** with
   `head = <epic-branch>`, `base = develop`. `pr-reviewer` runs
   another two-pass review on that consolidated diff. The
   orchestrator presents the epic PR URL to the user and **waits
   for explicit same-turn merge authorization** before anything
   touches `develop` — see rule 8b.
6. Once the user authorizes, the epic PR merges to `develop` (squash
   by default — one commit per epic on the develop history) and the
   epic branch is deleted.

**When the model applies**
- The user invokes `ship-epic` (the named entry point that
  enumerates sub-issues and dispatches in parallel).
- The user hands over an epic issue ad-hoc ("implement #66") and the
  orchestrator detects sub-issues in the body or via parent
  back-references.
- The user hands over a single sub-issue ("implement #142") and the
  orchestrator detects a parent epic via the issue's body
  ("Part of #66"). The orchestrator first checks whether the epic
  branch exists; if not, it creates one off `develop` and only then
  dispatches the sub-issue against it.

**When the model does NOT apply**
- Standalone issues with no parent epic — branch off `develop`,
  PR base = `develop`, rule 8 (single-tier merge gate) applies.
- Ad-hoc spikes (`spike/<date>-<desc>`) — no PR, no gates.
- Doc-only / chore tweaks the user explicitly wants merged
  one-shot to `develop`.

## Routing rules

1. **Single-package task** → delegate to the matching sub-agent via the `Agent`
   tool. Brief it with the user's goal, relevant file paths, and any
   constraints already established in conversation.
2. **Cross-package task** (e.g. add an endpoint + consume it on web) →
   orchestrate in order: `backend-dotnet` finishes the backend work →
   hand off to `web-react` and/or `mobile-expo`, who each run the `regen-api`
   skill in their own package before touching call sites. Wait for each step
   before starting the next, per the project's phase-gate rule. Run
   `regen-api` directly from the orchestrator only when no client work
   follows.
3. **Unsure which package** → ask the user with AskUserQuestion before
   delegating.
4. **Never** let a sub-agent modify files outside its package boundary. If a
   cross-cut is required, return to the orchestrator and route explicitly.
5. **Issue work** (create/edit/close/label/triage) routes to `github-issues`
   regardless of which package the issue is about. Package sub-agents never
   touch the GitHub API — they focus on code.
6. **Acceptance-criteria gate.** Work that starts from a GitHub issue is not
   "done" until `qa-tester` returns OVERALL ✅ PASS against that issue's ✅
   Acceptance criteria (or ✅ Expected behavior for bugs). Sequence:
   a. Dev sub-agent(s) finish their slice and report back.
   b. Orchestrator dispatches `qa-tester` with the issue number.
   c. If verdict is ❌ FAIL or ⚠️ PARTIAL, route the specific fix list to
      the owning dev sub-agent (`backend-dotnet` / `web-react` /
      `mobile-expo`), then re-run `qa-tester`. Iterate until PASS.
   d. Only after PASS does the orchestrator tell the user the task is done
      and (if applicable) suggest closing the issue via `github-issues`
      with a `Fixes #<N>` PR description.
   Skip this gate only if the task did not originate from a GitHub issue
   (ad-hoc spike, doc tweak with no AC). Never skip it to save a round
   trip — the AC is the contract.
7. **Code-review gate.** Once `qa-tester` returns ✅ PASS, the task is not
   "ready for merge" until `pr-reviewer` returns OVERALL ✅ READY FOR
   MERGE. Sequence:
   a. Orchestrator dispatches `pr-reviewer` with the issue number, the
      working branch, **and the explicit `base` branch** for the PR.
      Base selection follows the epic-branch model:
      - **Sub-issue of an epic** → `base = <epic-branch>` (the parent
        epic's `feature/<epic-N>-<short>` branch).
      - **Standalone issue or epic-level PR** → `base = develop`.
      - **Release PR** (rare; user-driven) → `base = main`.
   b. `pr-reviewer` creates (or updates) the PR against that base and
      runs the **two-pass review**: first-pass self-review (invokes
      the `review` skill + the project's hard-rule gate; short-circuits
      back to dev agents on BLOCKING findings), then — only once the
      self-review is clean — a second pass delegated to a fresh-eyes
      sub-reviewer via the `Agent` tool (briefed blind, no
      orchestrator context beyond the PR body + diff). Both passes
      must be clean for a READY FOR MERGE verdict.
   c. If verdict is 🔁 NEEDS REWORK, `pr-reviewer` returns a scope-tagged
      fix list. Orchestrator routes each section to the owning dev
      sub-agent (`backend-dotnet` / `web-react` / `mobile-expo`).
   d. After dev agents push fixes, orchestrator **re-dispatches
      `qa-tester` first** (rework can regress ACs), then re-dispatches
      `pr-reviewer` against the same PR. Iterate dev → qa → review until
      `pr-reviewer` returns READY FOR MERGE.
   e. Only after READY FOR MERGE does the orchestrator hand off to the
      merge gate (rule 8). Which sub-rule fires depends on the PR's
      base branch — sub-issue PRs go through 8a (auto-merge into the
      epic branch); epic / standalone PRs go through 8b (require
      explicit user authorization before touching `develop`).
   Skip this gate only for tasks that don't produce a PR (doc-only
   changes committed directly, infra-only tweaks the user explicitly
   merges out-of-band). Never skip to save a round trip — the review is
   the contract.
8. **Merge gate.** Behaviour depends on the PR's base branch.

   ### 8a. Sub-issue PR → epic branch (auto-merge, no user pause)

   When `pr-reviewer` returns ✅ READY FOR MERGE on a PR whose base is
   an **epic branch** (not `develop`, not `main`):

   - The orchestrator does **not** wait for per-PR user authorization.
     The whole point of the epic-branch model is that intermediate
     work lands on the epic branch invisibly to `develop` — burdening
     the user with N approvals for N sub-issues defeats the
     consolidation. The user authorizes the epic merge once, at 8b.
   - Pre-merge CI gate still applies. `gh pr checks <N>` must be all
     green. CI failures route to the owning dev sub-agent
     (backend/web/mobile) the same way as 8b. Pending checks are
     polled every ~30s up to 10 min, then escalated.
   - The merge exclusion list still applies absolutely — even on an
     epic branch, `pr-reviewer` refuses to merge if the diff touches
     `backend/**/Migrations/**` or Mongo data-mutation scripts. Those
     hit the user's hands regardless of the integration tier. (Base =
     `main` cannot occur for sub-issue PRs by construction; if it
     does, BLOCKED.)
   - Strategy from the PR's `type:*` label, same mapping:
     - `type:feature` / `type:bug` / `type:refactor` → `--squash`
       (one tidy commit per sub-issue on the epic branch — keeps the
       eventual epic PR's diff clean).
     - `type:docs` / `type:chore` → `--rebase` (preserves the granular
       commits on the epic branch).
   - After the merge, `pr-reviewer` syncs the **epic branch** locally
     (`git checkout <epic-branch> && git pull --ff-only`, sub-issue
     branch deleted best-effort), then the orchestrator rebases any
     in-flight sibling sub-issue branches onto the fresh epic-branch
     tip so their PRs don't go stale.
   - `notion-docs` is **not** dispatched per sub-issue. It runs once
     at 8b after the epic ships to `develop`.

   ### 8b. Epic PR / standalone PR → `develop` (or `main`) — explicit auth required

   When `pr-reviewer` returns ✅ READY FOR MERGE on a PR whose base is
   `develop` (epic-level PR with `head = <epic-branch>`, or a
   standalone issue's PR), the orchestrator reports the PR URL and
   **waits for explicit same-turn merge authorization** — a phrase
   like "merge it", "go ahead", "approved, merge". Historical
   approval from earlier in the conversation does not count.
   When authorized:

   **Pre-merge CI gate** (runs before `pr-reviewer` is re-dispatched
   for the merge): `gh pr checks <N>` must show every required check
   as `pass`. If any check is `fail` or still `pending`, the
   orchestrator does NOT proceed to merge. Instead:

   - For `fail`: read the failing job's log (`gh run view <id> --log`
     or `gh pr checks <N> --web`), diagnose the root cause, and route
     the fix to the owning dev sub-agent (backend → `backend-dotnet`;
     web → `web-react`; mobile → `mobile-expo`). After the fix is
     pushed, CI re-runs automatically; the orchestrator waits for
     green before merging. The user's earlier authorization carries
     through a single fix cycle — they don't need to re-authorize
     merely because CI forced a small correction — but a second CI
     failure on the same PR warrants surfacing back to the user for
     judgment ("should we keep iterating or drop the PR?").
   - For `pending`: wait. Poll with `gh pr checks <N>` every ~30s up
     to 10 min before escalating to the user. Never merge on an
     unresolved status.
   - For `pass`: continue to the merge dispatch below.
   a. Orchestrator re-dispatches `pr-reviewer` with the explicit
      authorization and the instruction to merge.
   b. `pr-reviewer` first checks the **merge exclusion list** (see below).
      If the PR hits any exclusion, it refuses to merge and returns
      BLOCKED with the reason — the user merges those PRs manually.
   c. Otherwise `pr-reviewer` picks the merge strategy from the PR's
      `type:*` label and runs `gh pr merge <n> <strategy>
      --delete-branch`. Strategy mapping:
      - `type:feature` / `type:bug` / `type:refactor` → `--squash`
        (one atomic commit per PR; clean, revertible). For epic PRs
        this means **the entire epic lands as a single commit on
        `develop`** — clean revert, clean changelog.
      - `type:docs` / `type:chore` → `--rebase` (preserves the granular
        commits on `develop`; history stays meaningful for small
        surgical changes).
      - No `type:*` label or conflicting labels → abort, return BLOCKED,
        and route label cleanup to `github-issues` before retrying.
      Then it verifies the merge landed, syncs the local `develop`
      (`git checkout develop && git pull --ff-only`, local feature /
      epic branch deleted best-effort) so the next issue starts from
      the freshly-merged state, and returns a MERGED verdict with the
      resulting commit SHA(s). Sync failures (dirty tree, non-ff local
      `develop`) surface as a ⚠️ warning on the otherwise-successful
      verdict — not a rollback; the merge already landed.
   d. Orchestrator then dispatches `notion-docs` (update mode) to
      document the change that just shipped. For an epic merge the
      docs entry covers all the sub-issues that landed in the
      consolidated commit, not one per sub-issue.

   **Merge exclusion list** (human-only, agent never merges these):
   - PRs whose base branch is `main` (any release into the main line).
   - PRs whose diff touches `backend/**/Migrations/**` (EF Core migrations
     — schema or data). Applies at both tiers — sub-issue PRs touching
     migrations also stay human-merged onto the epic branch.
   - PRs that add or modify MongoDB data-mutation scripts (bulk fix-ups,
     seed overrides, reprocessing jobs). Same — both tiers.
   - Any PR where the user has said in the current turn "I'll merge this
     one myself".

   Skip this gate only if no PR was produced (doc-only commits pushed
   directly, out-of-band infra tweaks). The agent never merges to
   `develop` or `main` without a fresh, in-turn go-ahead.

## Skills

| Skill             | What it does                                                                                                                 |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `fe-endpoint`     | Scaffolds a new FastEndpoints endpoint (request/response/validator/endpoint + test). Invoked from `backend-dotnet`.          |
| `mongo-document`  | Scaffolds a new MongoDB root aggregate (Id, ExternalId, Version, audit fields, collection registration). From `backend-dotnet`. |
| `signalr-event`   | Wires a realtime event end-to-end across backend → web → mobile. **Orchestrator-run**, dispatches per-package sections.      |
| `regen-api`       | Regenerates the TypeScript API client from Swagger. Run by the client sub-agent that needs it (`web-react` / `mobile-expo`).  |
| `web-page`        | Scaffolds a trainer-portal page (TanStack Query + RHF/Zod + shadcn primitives + i18n). From `web-react`.                     |
| `mobile-screen`   | Scaffolds an Expo Router screen (tokens via `useTheme()` + TanStack Query + i18n; `_layout.tsx` for sub-folders). From `mobile-expo`. |
| `notion-docs`     | Builds + incrementally maintains the project's documentation in Notion. Replaces the old `progress-update` / `docs/PROGRESS.md` workflow. Invoked at the end of any task (update mode) and for first-time setup (bootstrap mode). |
| `prototype-scene` | Adds a scene to an existing HTML prototype (`docs/mobile_prototype.html`, `docs/notion_portal.html`, `docs/trainer_prototype.html`) or scaffolds a new prototype file, matching each file's exact scene + nav wiring. |
| `ask-user-async`  | Posts a blocking question to Slack and cleanly ends the session. Use **only** when the user has declared AFK mode in the current turn ("I'm stepping away", "use async mode", "ping me on Slack") AND a genuine decision needs the user. Writes `.claude/pending-question.md` with full resume context. In-session questions still use `AskUserQuestion` — it's immediate and cheaper. |
| `resume-pending`  | The paired skill for `ask-user-async`. Run at the start of any session when `.claude/pending-question.md` exists, or when the user says "resume" / "continue" / "check Slack". Reads the Slack thread, extracts the answer, prints a resume plan, and hands the task back to the orchestrator. |
| `ui-tradeoff`     | Enforces Working Principles §4 (two-attempt stop rule). Invoke when an animation / layout / state-sync behaviour has failed twice on the same surface, or the user has said "it does not work" twice. Produces a tradeoff doc under `docs/ui-tradeoffs/` comparing 2–3 candidate approaches and demands a screen recording before attempt #3 is written. |
| `root-cause-swarm`| Enforces Working Principles §1 (no speculative patches) for gnarly multi-layer bugs. Brainstorms 5–7 hypothesis buckets (contract skew, DI lifetime, race, config, cache, version skew, auth, schema, external, platform), fans out parallel `Agent` probes — each producing a reproducing test OR a falsification proof — and synthesises the winning diagnosis before any fix is written. Saves to `docs/root-cause-swarms/`. |
| `ship-epic`       | Named entry-point for the full epic-to-PR lifecycle. Reads a GitHub epic + its sub-issues, plans parallel vs sequential dispatch, creates `.worktrees/<N>-<short>/` for concurrent children, runs each child through dev → qa-tester → pr-reviewer → merge → notion-docs per `.claude/CLAUDE.md` rules 6–8. Pauses at READY FOR MERGE for same-turn authorization (or batch mode if the user opts in). Orchestrator-only — never invoked by sub-agents. |

## Chainable plugin skills (external)

These are not project-local — they ship as installed plugins. The project
skills above reference them in their "Related skills to chain" sections.
Invoke by their fully-qualified name when finishing in-package work:

| Skill                          | Use after…                                                |
|--------------------------------|------------------------------------------------------------|
| `gc-sec-review`                | Adding/changing auth, ownership, upload, or invite endpoints |
| `engineering:code-review`      | Non-trivial backend changes or cross-package diffs        |
| `engineering:testing-strategy` | Endpoints with concurrency / ordering concerns             |
| `engineering:architecture`     | New aggregates, new cross-slice services, ADR-worthy decisions |
| `engineering:standup`          | Day-end summary of the Notion Changelog page                |
| `design:design-critique`       | New web page or mobile screen ready for review            |
| `design:accessibility-review`  | Any screen with forms, tables, modals, or color-critical UI |
| `design:ux-copy`               | Copy for CTAs, empty states, errors — in cs/en/de         |
| `design:design-system`         | Before adding new tokens/components to the theme          |
| `design:design-handoff`        | Translating a prototype scene into real code              |

## Branch & PR conventions

All code-bearing work follows this branch-name format:

```
<type>/<issue-number>-<short-kebab-description>
```

Where `<type>` matches the issue's `type:*` label:

| Issue type | Branch prefix | Example |
|---|---|---|
| `type:feature` | `feature/` | `feature/123-nutrition-plan-publish` |
| `type:bug` | `fix/` | `fix/124-plan-detail-crash-on-empty-week` |
| `type:refactor` | `refactor/` | `refactor/125-extract-macro-calculator` |
| `type:docs` | `docs/` | `docs/126-clarify-regen-api-skill` |
| `type:chore` | `chore/` | `chore/127-bump-expo-sdk` |

**Where the branch is rooted depends on whether the issue is part of an
epic** (see "Epic-branch model" above):

| Issue kind | Branched off | PR base |
|---|---|---|
| Standalone issue (no parent epic) | `develop` | `develop` |
| Epic issue (parent of sub-issues) | `develop` | `develop` *(opens at end of epic)* |
| Sub-issue of an epic | `feature/<epic-N>-<short>` (the epic branch) | the same epic branch |
| Release roll-up (rare) | `develop` | `main` |

Rules:

- Short description is kebab-case, ≤60 chars, derived from the issue title.
- The issue number is mandatory — it's how `pr-reviewer`, `qa-tester`, and
  `notion-docs` correlate work across the lifecycle.
- Dev sub-agents create the branch as their first step when they start work
  on an issue. The orchestrator tells them which base to root from
  (`develop` for standalone work; the epic branch name for sub-issues). If
  they start without an issue (ad-hoc spike), use `spike/<date>-<desc>`
  and don't open a PR.
- The epic branch itself is created by the orchestrator at epic kickoff —
  not by a dev sub-agent. It's pushed to `origin` immediately so all
  sub-issue worktrees can branch off `origin/<epic-branch>`.
- `pr-reviewer` validates the branch format **and the base branch** on
  first PR creation. Branch-name mismatch → bounce back to dev sub-agent
  for rename. Wrong base (e.g. a sub-issue PR opened against `develop`
  when an epic branch exists) → bounce back to fix the base before the
  review runs.

### Parallel sub-agents → one branch each, isolated via git worktree

When the orchestrator dispatches two or more sub-agents in parallel (e.g.
an epic fan-out that runs `backend-dotnet` + `web-react` concurrently, or
two `backend-dotnet` instances on different issues), each sub-agent MUST
work on its own branch, in its own working tree. **Never** let parallel
sub-agents share a checkout — their commits will interleave, one will
stomp the other's `git add`, and the PRs will mix unrelated diffs.

Rules:

- **One branch per sub-agent per dispatch.** The sub-agent creates its
  branch as its first step (`<type>/<issue>-<kebab>` from the table
  above), and does not switch branches mid-task.
- **Use `git worktree` for concurrency.** The orchestrator (or the
  sub-agent itself) creates a throwaway worktree rooted at
  `.worktrees/<issue-number>-<short>/`. **The base ref the worktree
  branches from depends on whether the issue is part of an epic:**

  Standalone issue (no parent epic):
  ```
  git worktree add .worktrees/123-nutrition-publish \
      -b feature/123-nutrition-plan-publish origin/develop
  ```

  Sub-issue of epic #66 (epic branch already pushed by the orchestrator
  as `feature/66-photos-epic`):
  ```
  git fetch origin feature/66-photos-epic
  git worktree add .worktrees/142-mobile-profile-photos \
      -b feature/142-mobile-profile-photos origin/feature/66-photos-epic
  ```

  The sub-agent works inside that path, pushes its branch, opens the PR
  against the correct base (sub-issue PR → epic branch; standalone PR →
  `develop`), and hands back. After merge, `pr-reviewer` removes the
  worktree: `git worktree remove .worktrees/<issue>-<short>`.
  `.worktrees/` is already gitignored under the Claude Code section.
- **Serial dispatch stays on the main checkout.** If two sub-agents run
  sequentially (backend finishes → web starts), the second can reuse
  the main working tree — but **check out the right base** first. For
  standalone work that's `develop`; for sub-issue work it's the epic
  branch (`git checkout <epic-branch> && git pull --ff-only`).
  Worktrees are the fix for *concurrent* work, not a blanket ritual.
- **Cross-package PRs for one issue stay on one branch.** A single
  GitHub issue that requires backend + web + mobile changes still ends
  up as one branch with one PR — dispatch those sub-agents sequentially
  on the same branch (each re-pulls before editing). Parallel fan-out
  is for *different issues*, never for splitting one issue across
  packages.
- **`pr-reviewer` enforces one-branch-per-PR.** If it sees commits on
  the branch that don't match the PR's issue number (e.g. another
  sub-agent's stray commit), it refuses to merge and returns BLOCKED
  with "branch contains unrelated commits".

Smells that break isolation:
- Two sub-agents both running `git checkout <same branch>` in the same
  working tree — one of them is about to lose work.
- A sub-agent running `git stash` to make room for a parallel task —
  stash is a band-aid; the correct answer is a worktree.
- A branch with commits authored by more than one sub-agent covering
  more than one issue number — split it before opening the PR.

## Guardrails (enforced by hooks)

- `src/api/generated.ts` in `/web` and `/mobile` is write-locked. The
  `block-generated-edits` PreToolUse hook rejects Edit/Write/MultiEdit against
  those paths. If the file needs to change, regenerate it via the `regen-api`
  skill.

## Task lifecycle reminder

0. **Session start — check for pending async questions.** Before
   touching anything else, look for `.claude/pending-question.md` at
   the repo root. If it exists with `status: waiting`, invoke the
   `resume-pending` skill immediately — it will fetch the Slack
   reply and hand back a resume plan. Also invoke `resume-pending` on
   phrases like "resume", "continue", "what was I working on?",
   "check Slack". If there's no pending file and the user didn't ask
   to resume, silently skip this step.
1. Read root `CLAUDE.md` before starting. `docs/PROGRESS.md` is frozen
   historical context only — don't append to it. The live documentation
   lives in Notion, maintained by `notion-docs`.
2. **Determine the integration tier before delegating.** If the task is
   a GitHub issue, fetch it and look for sub-issue references in the
   body or parent back-references on the issue itself.
   - Standalone issue → branch off `develop`, PR base `develop`,
     normal single-tier flow (rule 8b for the merge).
   - Epic issue (has sub-issues) → first create + push the epic branch
     `feature/<epic-N>-<short>` off the latest `develop`, then dispatch
     children. Epic-branch model (rules 7 / 8a / 8b) applies. Use the
     `ship-epic` skill if there are ≥2 sub-issues.
   - Sub-issue of an existing epic → confirm the epic branch is
     already pushed; if not, pause and create it first, then dispatch
     against `origin/<epic-branch>`.
3. Delegate to the correct sub-agent (or ask). Always tell the dev
   sub-agent which **base branch** to root from.
4. Stop between phases and wait for confirmation. **If a genuine
   blocker appears and the user has declared AFK mode in the current
   turn** ("stepping away", "use async mode", "ping me on Slack"),
   invoke the `ask-user-async` skill instead of guessing or stalling.
   The skill writes `.claude/pending-question.md`, posts the question
   to Slack, and ends the session cleanly. Never invoke it while the
   user is still actively in-session — use `AskUserQuestion` there.
5. If the task came from a GitHub issue, dispatch `qa-tester` to verify
   acceptance criteria. Loop dev → qa until PASS.
6. Once QA passes, dispatch `pr-reviewer` (with the right `base`) to
   open the PR and run `/review`. Loop dev → qa → review until
   `pr-reviewer` returns READY FOR MERGE.
7. **Sub-issue PR (base = epic branch)** — once READY FOR MERGE,
   re-dispatch `pr-reviewer` in `merge-sub-issue` mode without waiting
   for the user. The PR auto-merges into the epic branch (rule 8a).
   Rebase any in-flight sibling sub-issue branches onto the new epic
   tip, then move on to the next child. **Do not** dispatch
   `notion-docs` per sub-issue.

   **Epic PR or standalone PR (base = `develop`)** — once READY FOR
   MERGE, report the PR URL to the user and **wait** for explicit
   same-turn merge authorization. When authorized, re-dispatch
   `pr-reviewer` to merge. Strategy is chosen from the PR's `type:*`
   label — `--squash --delete-branch` for feature/bug/refactor,
   `--rebase --delete-branch` for docs/chore. Refuses automatically for
   excluded PRs (base = `main`, `backend/**/Migrations/**`, Mongo
   data-mutation scripts) — those merge manually. (Rule 8b.)
8. After a successful merge to `develop` (epic or standalone) — or
   after the user merges an excluded PR manually and confirms — invoke
   `notion-docs` (update mode) to document the change. On first use in
   a fresh workspace, invoke it in bootstrap mode instead.
