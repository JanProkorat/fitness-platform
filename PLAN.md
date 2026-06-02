# Implementation Plan — Training Session Edit-Lock

Spec: `docs/superpowers/specs/2026-06-01-training-session-lock-design.md`
Model: **epic** (backend + web + mobile). Epic branch → sub-issue branches.

## Dependency graph

```
#1 backend: SessionLock foundation
   ├── #2 backend: trainer-side enforcement   ┐
   └── #3 backend: client-side enforcement     ├─→ #4 cross-pkg: SignalR lock events
                                                │      ├── #5 web:    trainer lock UI
                                                │      └── #6 mobile: client lock UI
```

`#2` and `#3` are independent of each other (parallelizable after `#1`).
`#5`/`#6` depend on `#4` (realtime) and their respective backend slice + `regen-api`.

---

## Phase 1 — `#1` backend: SessionLock foundation
**Branch:** `feature/<child>-session-lock-foundation` off the epic branch.
- `Domain/Documents/SessionLock.cs`; `Domain/Enums/LockHolder.cs`, `LockType.cs`.
- Register collection in `MongoContext`; ensure indexes: unique `{sessionId}`,
  TTL `{expiresAt}` (`expireAfterSeconds:0`), `{clientId}`, `{planId}`.
- `Domain/Interfaces/ISessionLockService.cs` +
  `Infrastructure/Services/SessionLockService.cs`: `AcquireAsync` (E11000 →
  `LockConflict` result), `ReleaseAsync` (idempotent), `RefreshAsync` (slide
  `expiresAt`), `GetStateAsync(sessionIds[])` (batch).
- Tests (Testcontainers): contention → one winner; release idempotency; TTL doc
  expiry via past `expiresAt`; refresh slides expiry.
- **Verify:** `dotnet build` + `dotnet test` slice.

## Phase 2 — `#2` backend: trainer-side enforcement
**Depends:** `#1`. Branch off epic.
- `POST /training/plans/{planId}/sessions/{sessionId}/unlock` (acquire `Editing`,
  409 if `Live`).
- `POST /training/plans/{planId}/sessions/{sessionId}/relock` (release `Editing`).
- `UpdateTrainingPlan` diff+gate (§6): normalized content projection per published
  session; reject `409 session_locked` for changed sessions not `Editing`; release
  edited sessions' locks on success.
- `PublishTrainingWeek` defensive lock cleanup for the week's sessions.
- Tests: unlock-fails-when-live; diff-gate reject/allow; auto-release on save.
- **Verify:** `dotnet build` + `dotnet test` slice.

## Phase 3 — `#3` backend: client-side enforcement
**Depends:** `#1`. Branch off epic. (Parallel with `#2`.)
- `StartWorkout`: `Stable → Live` CAS, 409 if `Editing`, set `expiresAt`.
- `FinishWorkout` / abandon: release `Live` lock.
- `MarkExerciseComplete` + set-update endpoints: `RefreshAsync` slide.
- `GetTodaySession` / `GetFullPlan` responses: add per-session lock `state` + `holder`.
- Tests: start-fails-when-editing; finish releases; TTL refresh on set-log;
  response carries lock state.
- **Verify:** `dotnet build` + `dotnet test` slice.

## Phase 4 — `#4` cross-package: SignalR lock events
**Depends:** `#2`, `#3`. One branch, sequential per-package (via `signalr-event`).
- Backend: emit `sessioneditlockchanged { planId, sessionId, state, holder }` on
  acquire/release (both holders).
- Web + mobile: consume → invalidate the relevant TanStack Query keys.
- **Verify:** all three package verification surfaces.

## Phase 5 — `#5` web: trainer lock UI
**Depends:** `#2`, `#4`. `regen-api` first.
- Unlock-to-edit / relock action on a published session; editable-while-editing.
- In-progress badge + disabled edit affordance when `Live` (tooltip).
- Gated-save `409 session_locked` inline error naming sessions + unlock offer.
- i18n cs/en/de. Prototype: `docs/prototypes/notion/scenes/session-lock.html`.
- **Verify:** `npm run build`.

## Phase 6 — `#6` mobile: client lock UI
**Depends:** `#3`, `#4`. `regen-api` first.
- "Coach is updating — confirm before starting" banner when session `Editing`.
- Start-blocked 409 → toast; Live/finish handling.
- i18n cs/en/de. Prototype: `docs/prototypes/mobile/scenes/session-lock.html`.
- **Verify:** `npx tsc --noEmit` + `npx expo-doctor`.

---

## Out of scope (file as separate issues if wanted)
- Snapshot-on-start + prescribed-vs-actual audit history.
- Stable per-instance completion-key IDs (replace `exerciseExternalId` keying).
