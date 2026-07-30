# GoodFellas — Orchestration & Sub-agent Routing

This file supplements the root `CLAUDE.md`. It tells the main (orchestrator)
Claude how to route work to specialist sub-agents so each package's conventions
are applied consistently.

Detailed conventions live in [`rules/*.md`](rules/) — cite anchors, never
restate. Citation format: `rules/<file>.md#<anchor>`.

## Sub-agents

Project-local dev agents (live in `.claude/agents/`):

| Agent              | Use when work primarily touches…                                |
|--------------------|-----------------------------------------------------------------|
| `backend-dotnet`   | `/backend/**` — ASP.NET Core 10, FastEndpoints, EF/Mongo, SignalR |
| `web-react`        | `/web/**` — React 19, Vite, shadcn, TanStack Query, RHF + Zod   |
| `mobile-expo`      | `/mobile/**` — React Native, Expo Router, Zustand, design tokens |

Project-local workflow agents (also in `.claude/agents/`):

| Agent              | Role                                                            |
|--------------------|-----------------------------------------------------------------|
| `github-issues`    | GitHub issue lifecycle (create, edit, label, triage, close). Not for PRs or code. |
| `qa-tester`        | Verify a GitHub issue's ✅ Acceptance criteria after dev agents finish. Read-only at the source-tree level. Drives Playwright + iOS Simulator (XcodeBuildMCP) for AC flows. Returns PASS / PARTIAL / FAIL. |
| `pr-reviewer`      | Runs after `qa-tester` PASS. Creates/updates the PR (against the base the orchestrator passes — see [`rules/branch-and-pr.md`](rules/branch-and-pr.md)), runs a two-pass review (self + fresh-eyes Agent), and merges per [`rules/merge-strategy.md`](rules/merge-strategy.md). |
| `design-reviewer`  | Pre-implementation gate. Reads issue + dispatch brief BEFORE dev agents start. Returns APPROVE / NEEDS-REVISION / BLOCK with structured `approved_scope`. |

## Project facts

- **Repo:** `JanProkorat/fitness-platform`
- **Local path:** `/Users/jan/Projects/fitness-platform`
- **Active base branch:** `develop` (release: `main`)

## Label taxonomy

- `type:*` — `feature`, `bug`, `refactor`, `docs`, `chore`
- `scope:*` — `backend`, `web`, `mobile`, `docs-infra`
- `priority:*` — `p1`, `p2`, `p3`
- `status:*` — `needs-triage`, `blocked`, `in-progress`
- Extra — `duplicate`, `help wanted`, `invalid`, `wontfix`, `good-first-issue`

## Key cross-references

| What | Where |
|---|---|
| Scope → dev-agent mapping, package boundaries, scope → stack map | [`rules/scope-boundaries.md`](rules/scope-boundaries.md) |
| Branch naming, worktree pattern, parallel safety | [`rules/branch-and-pr.md`](rules/branch-and-pr.md) |
| Epic-branch model (two-tier integration) | [`rules/epic-branch.md`](rules/epic-branch.md) |
| Merge strategy, sub-issue auto-merge, exclusion list | [`rules/merge-strategy.md`](rules/merge-strategy.md) |
| Hardcoded-value bans, write-locked generated files | [`rules/code-style.md`](rules/code-style.md) |
| i18n mechanism (generic) — locale list is repo-specific, see below | [`rules/i18n.md`](rules/i18n.md), "Locales" below |
| Verification surfaces per scope | [`rules/verification-contract.md`](rules/verification-contract.md) |

## Scope → stack map

Each `scope:*` label maps to exactly one stack pack. Dev sub-agents and the
pack `<stack>-verify`/`<stack>-build` skills use this to decide which pack
applies to a given path (full detail:
[`rules/scope-boundaries.md#scope-to-stack-mapping`](rules/scope-boundaries.md#scope-to-stack-mapping)):

| Path glob    | Stack    | Verify skill    |
|--------------|----------|-----------------|
| `/backend/**`| `dotnet` | `dotnet-verify`  |
| `/web/**`    | `react`  | `react-verify`   |
| `/mobile/**` | `expo`   | `expo-verify`    |

## Locales

Supported locales: `cs` (primary), `en`, `de`; files at
`web/src/i18n/locales/*.json` and `mobile/src/i18n/locales/*.json`. This is
the repo-specific fact the generic react/expo pack `i18n` rule defers to —
the packs describe the i18n *mechanism* (keys, `useTranslation()`,
missing-locale fallback), never a fixed locale list of their own.

## Branch / PR / merge precedence

Branch/PR/merge in this repo follow [`rules/branch-and-pr.md`](rules/branch-and-pr.md)
+ [`rules/merge-strategy.md`](rules/merge-strategy.md) — issue+epic-based,
with sub-issue auto-merge performed by `pr-reviewer`. Where the seeded hub
[`rules/pr-workflow.md`](rules/pr-workflow.md) / [`rules/git-workflow.md`](rules/git-workflow.md)
differ (they assume a `/conductor`-style pipeline and forbid a subagent from
ever touching the remote — no merges, no pushes), **the local rules win**:
this repo's pipeline is issue+epic-based, and `pr-reviewer` is explicitly
the sub-agent that opens PRs and performs sub-issue auto-merge per
[`rules/merge-strategy.md#sub-issue-auto-merge`](rules/merge-strategy.md#sub-issue-auto-merge).

## Prototype locations

Design-fidelity checks read these source files (top-level `docs/*.html`
artifacts are generated — always read the per-scene source):

- Mobile app → `docs/prototypes/mobile/scenes/*.html`
- Trainer portal → `docs/prototypes/trainer/scenes/*.html`
- Notion portal → `docs/prototypes/notion/scenes/*.html`

## Routing rules

1. **Single-package task** → delegate to the matching sub-agent via the `Agent`
   tool. Brief it with the user's goal, relevant file paths, and any constraints
   already established in conversation.
2. **Cross-package task** → orchestrate sequentially per
   [`rules/scope-boundaries.md#cross-package-coordination`](rules/scope-boundaries.md#cross-package-coordination).
3. **Unsure which package** → ask the user with `AskUserQuestion` before delegating.
4. **Never** let a sub-agent modify files outside its package boundary
   (see [`rules/scope-boundaries.md#package-boundary-rule`](rules/scope-boundaries.md#package-boundary-rule)).
   `pr-reviewer` enforces this on the diff.
5. **Issue work** (create/edit/close/label/triage) routes to `github-issues`
   regardless of which package the issue is about. Package sub-agents never
   touch the GitHub API — they focus on code.
5.5. **Design-review gate.** Before dispatching a dev sub-agent for an issue,
   invoke `design-reviewer` with the issue number + the dispatch brief
   (target sub-agent, base branch, scope summary, guessed files-in-scope).
   - **APPROVE** → proceed with dispatch. Pass `approved_scope.files_in_scope`,
     `required_reads`, and `error_paths` to the dev agent as its scope contract
     (it reads `state/handoff-design-<issue>.json` as its first action).
   - **NEEDS-REVISION** → address the listed findings (usually tighten the
     brief — drop out-of-scope files, add missing test plan), re-submit.
     Loop up to **3 rounds total**. Round 4 NEEDS-REVISION → surface to user.
   - **BLOCK** → surface `blocked_reason` to user. Common causes: AC needs
     clarification (route to `github-issues`), missing parent epic branch
     (create it first), fundamental architecture conflict.
   Skip only for ad-hoc spikes that don't originate from a GitHub issue.
   Doc tweaks and chore PRs still go through it (lightweight pass).
6. **Acceptance-criteria gate.** Work that starts from a GitHub issue is not
   "done" until `qa-tester` returns OVERALL ✅ PASS. Sequence:
   a. Dev sub-agent(s) finish their slice and report back via the dev-handoff
      JSON (see [`schemas/dev-handoff.v1.json`](schemas/dev-handoff.v1.json)).
   b. Orchestrator dispatches `qa-tester` with the issue number.
   c. ❌ FAIL → route the fix list to the owning dev sub-agent, then re-run
      `qa-tester`. Iterate until at least the static + bash-smoke surface
      passes (PASS / PARTIAL / INTERACTIVE-REQUIRED).
   c2. ⚠️ INTERACTIVE-REQUIRED → orchestrator runs the interactive QA
      playbook on the main thread (see rule 6.5), consolidates evidence
      into the per-AC results, and produces a final verdict. If interactive
      drive surfaces a defect, route the fix back to dev and restart the
      gate from (b). If interactive drive passes all flagged ACs, proceed
      to the code-review gate (rule 7).
   c3. ⚠️ PARTIAL (missing fixture / data, not tooling) → either fix the
      gap (e.g. extend `QaSeedRunner` via `backend-dotnet`) or accept the
      gap with a follow-up issue; user decides. PARTIAL with a documented
      gap may proceed to code-review on user authorization.
   d. PASS → orchestrator tells the user the task is done and (if applicable)
      suggests closing via `github-issues` with `Fixes #<N>`.
   Skip only if the task did not originate from a GitHub issue. Never skip to
   save a round trip — the AC is the contract.

6.5. **Orchestrator-driven interactive QA playbook.** Triggered when
   `qa-tester` returns ⚠️ INTERACTIVE-REQUIRED. The orchestrator's main
   thread has the MCP tool surface the sub-agent lacks (`mcp__xcodebuildmcp__*`
   ui-automation, `mcp__plugin_playwright_playwright__*`,
   `mcp__a11y-accessibility__*`). For each AC the qa-tester flagged with
   `met: false` and an interactive-evidence note:

   - **iOS native flows** — load the schemas:
     `ToolSearch select:mcp__xcodebuildmcp__list_sims,boot_sim,install_app_sim,launch_app_sim,stop_app_sim,screenshot,snapshot_ui,tap,type_text,swipe,gesture,button,long_press`.
     Resolve the simulator via `list_sims` (precedence: booted → config-
     name → newest installed). Use the dev-client `.app` from
     `mobile/.qa-cache/<sha>.app` (built fresh by qa-tester in step C of
     its iOS path). Drive via `snapshot_ui` → `tap` by accessibility id
     → `type_text` / `swipe` as the AC requires. Capture evidence to
     `.qa-artifacts/<issue>/orchestrator-<scene>.png`. If the iOS
     "Open in App?" prompt appears after `xcrun simctl openurl`, snapshot
     and tap the "Otevřít" / "Open" button before proceeding.

   - **Web spec drive** — load the schemas:
     `ToolSearch select:mcp__plugin_playwright_playwright__browser_navigate,browser_click,browser_fill_form,browser_snapshot,browser_take_screenshot,browser_wait_for,browser_evaluate`.
     Point at `:5173` (which proxies to compose harness `:5101`). Pull
     auth from `.auth/<role>.json` (produced by `web/tests/e2e/auth.setup.ts`)
     or call `mobile/scripts/qa-fetch-refresh-token.sh <role>` and inject
     into localStorage. Capture accessibility-tree snapshots + screenshots
     under `.qa-artifacts/<issue>/orchestrator-web-<scene>.png`.

   - **a11y audits** — load the schemas:
     `ToolSearch select:mcp__a11y-accessibility__test_accessibility,test_html_string,check_aria_attributes,check_color_contrast`.
     Run after the interactive drive lands on the target screen.

   - **Consolidation** — write the orchestrator's findings as a final
     section in `state/handoff-qa-<issue>.json` (extend the existing file
     in place, do not rewrite the qa-tester sub-agent's portion). Update
     `verdict` from `INTERACTIVE-REQUIRED` to `PASS` if all flagged ACs
     are now verified, `FAIL` if any interactive check shows a defect, or
     keep `PARTIAL` if some ACs remain blocked on fixture gaps.

   - **Teardown** — same rule as qa-tester step 8: leave a pre-booted
     user-owned simulator running, only shut down sims the orchestrator
     itself booted. Uninstall the dev-client `.app` either way.

   This playbook is also the path for ad-hoc smoke tests the user asks for
   directly ("run the deep-link bypass against the booted sim"), without
   going through a full qa-tester dispatch.
7. **Code-review gate.** Once `qa-tester` returns ✅ PASS, the task is not
   "ready for merge" until `pr-reviewer` returns ✅ READY FOR MERGE. Sequence:
   a. Orchestrator dispatches `pr-reviewer` with the issue number, the
      working branch, and the explicit `base` branch (per
      [`rules/branch-and-pr.md`](rules/branch-and-pr.md)).
   b. `pr-reviewer` opens/updates the PR and runs the two-pass review:
      first-pass self-review (invokes the `review` skill + the project's
      hard-rule gate); then — only if the self-review is clean — a second
      pass delegated to a fresh-eyes sub-reviewer via `Agent` (briefed
      blind, no orchestrator context beyond PR body + diff). Both passes
      must be clean for READY FOR MERGE.
   c. 🔁 NEEDS REWORK → `pr-reviewer` returns a scope-tagged fix list.
      Orchestrator routes each section to the owning dev sub-agent.
   d. After fixes, **re-dispatch `qa-tester` first** (rework can regress
      ACs), then re-dispatch `pr-reviewer` against the same PR. Iterate
      dev → qa → review until READY FOR MERGE.
   e. READY FOR MERGE → hand off to the merge gate (rule 8). Skip only for
      tasks that don't produce a PR (doc-only commits, infra-only tweaks
      the user explicitly merges out-of-band).
8. **Merge gate.** Behaviour depends on the PR's base branch:
   - **Sub-issue PR (base = epic branch)** → auto-merge per
     [`rules/merge-strategy.md#sub-issue-auto-merge`](rules/merge-strategy.md#sub-issue-auto-merge).
   - **Epic PR / standalone PR (base = `develop`)** → require explicit
     same-turn user authorization per
     [`rules/merge-strategy.md#authorized-merge`](rules/merge-strategy.md#authorized-merge).
   - **Excluded PRs** (base=`main`, migrations, Mongo data-mutation scripts) →
     refuse and BLOCK per
     [`rules/merge-strategy.md#exclusion-list`](rules/merge-strategy.md#exclusion-list).

## Skills

| Skill             | What it does                                                                                                                 |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `fe-endpoint`     | Scaffolds a new FastEndpoints endpoint (request/response/validator/endpoint + test). Invoked from `backend-dotnet`.          |
| `mongo-document`  | Scaffolds a new MongoDB root aggregate (Id, ExternalId, Version, audit fields, collection registration). From `backend-dotnet`. |
| `signalr-event`   | Wires a realtime event end-to-end across backend → web → mobile. Orchestrator-run.                                           |
| `regen-api`       | Regenerates the TypeScript API client from Swagger. Run by the client sub-agent that needs it.                                |
| `web-page`        | Scaffolds a trainer-portal page (TanStack Query + RHF/Zod + shadcn primitives + i18n). From `web-react`.                     |
| `mobile-screen`   | Scaffolds an Expo Router screen (tokens via `useTheme()` + TanStack Query + i18n). From `mobile-expo`.                       |
| `notion-docs`     | Builds + incrementally maintains the project's documentation in Notion.                                                       |
| `prototype-scene` | Adds a scene to an existing HTML prototype, or scaffolds a new prototype file.                                                |
| `ask-user-async`  | Posts a blocking question to Slack and ends the session cleanly. Use only when the user has declared AFK mode in the current turn. |
| `resume-pending`  | Paired skill for `ask-user-async` — pick up the answer at session start.                                                      |
| `ui-tradeoff`     | Enforces Working Principles §4 (two-attempt stop rule).                                                                       |
| `root-cause-swarm`| Enforces Working Principles §1 (no speculative patches) for multi-layer bugs.                                                 |
| `ship-epic`       | Full epic-to-PR lifecycle. Orchestrator-only. See [`rules/epic-branch.md`](rules/epic-branch.md).                            |

## Chainable plugin skills (external)

These ship as installed plugins. Invoke by their fully-qualified name:

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

## Guardrails (enforced by hooks)

- `src/api/generated.ts` in `/web` and `/mobile` is write-locked. The
  `block-generated-edits` PreToolUse hook rejects Edit/Write/MultiEdit on
  those paths. To change shapes, regenerate via the `regen-api` skill.
- Compound commands (`&&` / `;`) get split via `split-compound-commands.sh`
  so each part passes permission validation independently.
- Subagents cannot run `gh pr merge` or `git push --force` — `deny-subagent-merge.sh`
  blocks them. Merging is `pr-reviewer`'s job, dispatched from the main thread.
- Each agent has a curated bash allowlist via `agent-bash-allowlist.sh` —
  e.g. `qa-tester` is blocked from `git commit`, `backend-dotnet` from `npm`.
- Sub-agent handoffs are JSON-schema-validated before control returns
  (`gate-check.sh` SubagentStop hook). Schemas under `.claude/schemas/`.
- Long-running orchestration state persists to `.claude/state/ship-epic.json`;
  `reinject-state.sh` re-hydrates context after `/clear` or compact.

## Task lifecycle reminder

0. **Session start — check for pending async questions.** Look for
   `.claude/pending-question.md`. If present with `status: waiting`, invoke
   `resume-pending`. Same on phrases like "resume", "continue", "check Slack".
1. Read root `CLAUDE.md` before starting. Live documentation is in Notion
   (`notion-docs` maintains it); `docs/PROGRESS.md` is frozen historical context.
2. **Determine the integration tier.** If a GitHub issue, fetch and check for
   sub-issue references. Standalone → branch off `develop`. Epic → first create
   + push the epic branch off `develop`, then dispatch children
   (`ship-epic` for ≥2 sub-issues). Sub-issue of existing epic → confirm the
   epic branch is pushed; create it first if not.
3. Delegate to the correct sub-agent. Always tell the dev sub-agent which
   base branch to root from.
4. **Stop between phases and wait for confirmation.** If a genuine blocker
   appears and the user has declared AFK mode in the current turn, invoke
   `ask-user-async`. In-session questions still use `AskUserQuestion`.
5. From a GitHub issue → dispatch `qa-tester` after dev. Loop dev → qa
   until PASS.
6. After QA PASS → dispatch `pr-reviewer` with the right base. Loop
   dev → qa → review until READY FOR MERGE.
7. Sub-issue PR → re-dispatch `pr-reviewer` to auto-merge (no user pause).
   Epic / standalone PR → wait for explicit same-turn merge auth.
8. After merge to `develop` (epic or standalone) → invoke `notion-docs`
   (update mode). On first use in a fresh workspace → bootstrap mode.
