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

Global workflow agents (live in `~/.claude/agents/`, shared across all projects — they read the **Project conventions** section below for fitness-platform-specific values):

| Agent              | Role                                                            |
|--------------------|-----------------------------------------------------------------|
| `github-issues`    | GitHub issue lifecycle (create, edit, label, triage, close). Not for PRs or code. |
| `qa-tester`        | Verify a GitHub issue's ✅ Acceptance criteria after dev agents finish. Read-only — returns PASS / FAIL / PARTIAL with evidence. |
| `pr-reviewer`      | Runs after `qa-tester` PASS. Creates/updates the PR, invokes the `review` skill, classifies findings, and returns a scope-tagged fix list to the orchestrator or a "ready for merge" verdict. Also performs the final merge when the orchestrator passes explicit same-turn user authorization — `--squash --delete-branch` for `type:feature` / `type:bug` / `type:refactor`, `--rebase --delete-branch` for `type:docs` / `type:chore`. Never force-pushes, never merges excluded PRs (see rule 8). |

## Project conventions (read by global agents)

The global workflow agents (`qa-tester`, `pr-reviewer`, `github-issues`)
are project-agnostic. They read this section to pick up the values they
need for this repo. Keep it in sync with the rest of the file.

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
| `backend`      | `dotnet test` (Testcontainers — Docker required), `curl` against `http://localhost:5000`, Swagger at `/swagger` |
| `web`          | `npm run build`, `npm run typecheck` (if present), dev server at `http://localhost:5173` |
| `mobile`       | `npx tsc --noEmit`, `npx expo prebuild --no-install --check`, simulator probes |
| `docs-infra`   | File diff, workflow dry-run where possible                       |

**Review skill**
- Invoke as `Skill: review` against the PR URL/number — this is the
  project's code-review flow used by `pr-reviewer`.

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
   a. Orchestrator dispatches `pr-reviewer` with the issue number and the
      working branch.
   b. `pr-reviewer` creates (or updates) the PR and runs the `review`
      skill against it.
   c. If verdict is 🔁 NEEDS REWORK, `pr-reviewer` returns a scope-tagged
      fix list. Orchestrator routes each section to the owning dev
      sub-agent (`backend-dotnet` / `web-react` / `mobile-expo`).
   d. After dev agents push fixes, orchestrator **re-dispatches
      `qa-tester` first** (rework can regress ACs), then re-dispatches
      `pr-reviewer` against the same PR. Iterate dev → qa → review until
      `pr-reviewer` returns READY FOR MERGE.
   e. Only after READY FOR MERGE does the orchestrator tell the user
      the PR is ready to merge and surface the PR URL. What happens next
      is handed off to the merge gate (rule 8): the orchestrator waits
      for explicit in-turn authorization before anyone — human or agent
      — touches the merge button.
   Skip this gate only for tasks that don't produce a PR (doc-only
   changes committed directly, infra-only tweaks the user explicitly
   merges out-of-band). Never skip to save a round trip — the review is
   the contract.
8. **Merge gate.** Once `pr-reviewer` returns ✅ READY FOR MERGE, the
   orchestrator reports the PR URL to the user and **waits for explicit
   same-turn merge authorization** — a phrase like "merge it", "go
   ahead", "approved, merge". Historical approval from earlier in the
   conversation does not count. When authorized:
   a. Orchestrator re-dispatches `pr-reviewer` with the explicit
      authorization and the instruction to merge.
   b. `pr-reviewer` first checks the **merge exclusion list** (see below).
      If the PR hits any exclusion, it refuses to merge and returns
      BLOCKED with the reason — the user merges those PRs manually.
   c. Otherwise `pr-reviewer` picks the merge strategy from the PR's
      `type:*` label and runs `gh pr merge <n> <strategy>
      --delete-branch`. Strategy mapping:
      - `type:feature` / `type:bug` / `type:refactor` → `--squash`
        (one atomic commit per PR; clean, revertible).
      - `type:docs` / `type:chore` → `--rebase` (preserves the granular
        commits on `develop`; history stays meaningful for small
        surgical changes).
      - No `type:*` label or conflicting labels → abort, return BLOCKED,
        and route label cleanup to `github-issues` before retrying.
      Then it verifies the merge landed, syncs the local `develop`
      (`git checkout develop && git pull --ff-only`, local feature
      branch deleted best-effort) so the next issue starts from the
      freshly-merged state, and returns a MERGED verdict with the
      resulting commit SHA(s). Sync failures (dirty tree, non-ff local
      `develop`) surface as a ⚠️ warning on the otherwise-successful
      verdict — not a rollback; the merge already landed.
   d. Orchestrator then dispatches `notion-docs` (update mode) to
      document the change that just shipped.

   **Merge exclusion list** (human-only, agent never merges these):
   - PRs whose base branch is `main` (any release into the main line).
   - PRs whose diff touches `backend/**/Migrations/**` (EF Core migrations
     — schema or data).
   - PRs that add or modify MongoDB data-mutation scripts (bulk fix-ups,
     seed overrides, reprocessing jobs).
   - Any PR where the user has said in the current turn "I'll merge this
     one myself".

   Skip this gate only if no PR was produced (doc-only commits pushed
   directly, out-of-band infra tweaks). The agent never merges without a
   fresh, in-turn go-ahead.

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

All code-bearing work branches off `develop` and follows this format:

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

Rules:

- Short description is kebab-case, ≤60 chars, derived from the issue title.
- The issue number is mandatory — it's how `pr-reviewer`, `qa-tester`, and
  `notion-docs` correlate work across the lifecycle.
- Dev sub-agents create the branch as their first step when they start work
  on an issue. If they start without an issue (ad-hoc spike), use
  `spike/<date>-<desc>` and don't open a PR.
- `pr-reviewer` validates the branch format on first PR creation. A branch
  that doesn't match is bounced back to the dev sub-agent to rename before
  the PR is opened — it's cheap to fix early, noisy later.

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
  `.worktrees/<issue-number>-<short>/`:
  ```
  git worktree add .worktrees/123-nutrition-publish \
      -b feature/123-nutrition-plan-publish origin/develop
  ```
  The sub-agent works inside that path, pushes its branch, opens the PR,
  and hands back. After merge, `pr-reviewer` removes the worktree:
  `git worktree remove .worktrees/123-nutrition-publish`. `.worktrees/`
  is already gitignored under the Claude Code section.
- **Serial dispatch stays on the main checkout.** If two sub-agents run
  sequentially (backend finishes → web starts), the second can reuse
  the main working tree and checkout `develop` cleanly — no worktree
  needed. Worktrees are the fix for *concurrent* work, not a blanket
  ritual.
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
2. Delegate to the correct sub-agent (or ask).
3. Stop between phases and wait for confirmation. **If a genuine
   blocker appears and the user has declared AFK mode in the current
   turn** ("stepping away", "use async mode", "ping me on Slack"),
   invoke the `ask-user-async` skill instead of guessing or stalling.
   The skill writes `.claude/pending-question.md`, posts the question
   to Slack, and ends the session cleanly. Never invoke it while the
   user is still actively in-session — use `AskUserQuestion` there.
4. If the task came from a GitHub issue, dispatch `qa-tester` to verify
   acceptance criteria. Loop dev → qa until PASS.
5. Once QA passes, dispatch `pr-reviewer` to open the PR and run `/review`.
   Loop dev → qa → review until `pr-reviewer` returns READY FOR MERGE.
6. Report the PR URL to the user and **wait** for explicit same-turn
   merge authorization. When authorized, re-dispatch `pr-reviewer` to
   merge. Strategy is chosen from the PR's `type:*` label —
   `--squash --delete-branch` for feature/bug/refactor,
   `--rebase --delete-branch` for docs/chore. Refuses automatically for
   excluded PRs (base = `main`, `backend/**/Migrations/**`, Mongo
   data-mutation scripts) — those merge manually.
7. After a successful merge (or after the user merges an excluded PR
   manually and confirms), invoke `notion-docs` (update mode) to
   document the change. On first use in a fresh workspace, invoke it in
   bootstrap mode instead.
