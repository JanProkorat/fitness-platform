# Execution Plan — Backend Hardening Batch (#650–#662)

**Integration model:** Umbrella epic (per user decision). One epic branch off
`develop`; each of the 13 issues is a sub-issue whose PR auto-merges into the
epic branch (no per-issue auth); one final epic PR → `develop` with a single
user authorization.

All 13 are `scope:backend` → dev agent is `backend-dotnet` for every one.
Each issue still runs the full gate: design-review → dev → qa-tester →
pr-reviewer → (auto-merge to epic branch).

---

## Phase 0 — Epic setup (one turn)

1. `github-issues`: create umbrella epic **"Backend hardening batch (#650–#662)"**
   (`type:chore` / `scope:backend`), body enumerating the 13 as a checklist,
   and add each as a sub-issue / back-reference.
2. Orchestrator: create + push epic branch `feature/<E>-backend-hardening`
   off latest `develop`.
3. Start time-tracking clocks for all 13 under the epic name.

*Stop for confirmation that the epic + branch look right before dispatching.*

---

## Wave A — independent fixes, parallel-safe (worktrees off epic branch)

Disjoint file sets → run in parallel sub-batches of ~3–4. Each dev agent in its
own worktree `.worktrees/<N>-<short>/` based on `origin/<epic-branch>`.

| # | Pri | Scope (files) | Note |
|---|-----|---------------|------|
| #653 | P1 | `Messaging/StartConversation` | empty-name `[..1]` crash guard, 2 call sites |
| #651 | P1 | `TrainingPlans/FinishSession` + `WorkoutCompletionService` | ClientId convention (UserId, not PublicId) |
| #652 | P1 | `Auth/RefreshToken` + `RefreshToken` entity **+ EF migration** | reuse/theft detection + concurrency guard |
| #654 | P2 | `Client/Invites/Accept` + `Decline` | recipient NormalizedEmail check (IDOR) |
| #656 | P2 | `Auth/ResetPassword` | normalize error msg (enumeration oracle) |
| #657 | P2 | `Questionnaires/GetClientResponse(s)` | add `IsActive` to link check |
| #658 | P2 | `Users/Avatar` + `Professionals/Avatar` (+ validators) | validate BlobUrl host + key pattern |
| #661 | P2 | `WorkoutLogs/UpdateWorkout` | hoist history fetch out of PR loop |
| #662 | P2 | `ClientTraining/MarkWholeDayComplete` | `Filter.In` batch query |

**#652 caveat:** adds an EF migration → hits the merge **exclusion list**
(`Migrations/**`). Its sub-issue PR is human-merged onto the epic branch, not
auto-merged. Flagged to user at that point.

---

## Wave B — Trainers/Compliance cluster (sequential; shared `ComplianceService` surface)

1. **#650** (P1) — correctness: `GetClientTimeline`, `ListClientPlans`,
   `ComplianceService` keyed on `ClientProfile.PublicId` not `UserId`.
2. **#660** (P2) — perf: `GetDashboardSummary` N+1 → `Task.WhenAll` batching
   (rebased on #650, since both touch the compliance call surface).

---

## Wave C — Publish-week refactor cluster (sequential; shared `PublishWeek` files)

1. **#655** (P2) — reorder: version-gated replace first, archive siblings only
   after `ModifiedCount == 1`, in both Nutrition + Training publish endpoints.
2. **#659** (P2 refactor) — extract `Domain/Services/PlanConcurrencyGuardService`
   (fetch-check-replace-409 skeleton) across the 6 pairs; preserves the
   #655-correct ordering as a single code path. Rebased on #655.

---

## Phase 3 — Epic PR → develop

Once all 13 sub-issues are merged into the epic branch: open epic PR
`head=<epic-branch>`, `base=develop`; `pr-reviewer` two-pass review on the
consolidated diff; present URL and **wait for explicit merge authorization**.
CI-gate before merge. After merge: `notion-docs` (update mode), one entry
covering the whole batch.

---

## Execution discipline

- **One wave per turn**, commit per issue (natural resume points).
- Full `dotnet build` + relevant `dotnet test` slice per issue; full feature
  namespace when an endpoint's behaviour/constructor changes (per memory).
- Parallel dev agents never share the main tree — worktree each.
- Likely `/clear` between waves to keep orchestrator context fresh.
- Sibling rebase onto epic-branch tip after each sub-issue auto-merge.
