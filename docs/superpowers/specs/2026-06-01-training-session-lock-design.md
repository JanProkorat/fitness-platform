# Training Session Edit-Lock — Design Spec

**Date:** 2026-06-01
**Status:** Approved (brainstorming) → ready for implementation plan
**Scope:** backend + web + mobile (epic)

---

## 1. Problem

When a trainer publishes a training-plan week, the client can immediately start a
live training session against it. But the trainer can still edit a published
week's session content at any time (the only existing guard blocks *removing* a
published week, not editing one). The client always reads the **live** plan
document on every request — `GetTodaySession` / `GetFullPlan` re-read it; there is
no snapshot taken at session start. `StartWorkout` creates a `WorkoutLog` that
holds only `PlanId` + `SessionId` references and fills with *actuals*.

This produces two collisions:

1. **Edit during a live session.** Client taps Start and is logging sets; the
   trainer edits that same session. On the client's next read the session reshapes
   under them, and logged completion — keyed by `(sessionId, exerciseExternalId,
   setNumber)` — can dangle or map onto the wrong exercise.
2. **Start during an edit.** Client starts while the trainer is mid-edit.

The existing plan-level optimistic-concurrency `Version` only protects
trainer-vs-trainer writes; it does nothing for trainer-edit-vs-client-session
because those touch **different documents** (`TrainingPlan` vs `WorkoutLog`).

## 2. Goals / Non-goals

**Goals**
- A published session is never edited by the trainer while a client is running it,
  and a client can never start a session the trainer is actively editing —
  **enforced server-side**, not by etiquette.
- The trainer can still correct mistakes at any time, via an explicit per-session
  unlock.
- Both parties see the state (labels/badges), but correctness never depends on a
  notification being delivered.
- Abandoned states self-heal (no permanent locks).

**Non-goals (separate follow-ups, see §12)**
- Snapshot-on-start / prescribed-vs-actual audit history.
- Hardening the `(sessionId, exerciseExternalId, setNumber)` completion key with
  stable per-instance IDs.

## 3. State model

One authoritative state per **session** (a session is identified by its stable
`TrainingSession.SessionId` Guid):

| State | Trainer may edit? | Client may start? | Entered by |
|---|---|---|---|
| **Stable** (default) | no | **yes** | week published, or any lock released |
| **Editing** | **yes** | no | trainer explicitly unlocks the session |
| **Live** | no | — | client started a workout |

Transitions are all **atomic compare-and-set**; the loser receives `409 Conflict`
(RFC 7807 Problem Details) with a machine-readable error code and the offending
session id(s).

```
publish week          → each session: Stable
trainer Unlock        : Stable → Editing   (fails if Live  → "client is training")
trainer Save/Relock   : Editing → Stable   (auto-relock on a successful save)
client Start          : Stable → Live      (fails if Editing → "coach is editing")
client Finish/Abandon : Live → Stable
TTL expiry            : Editing → Stable  AND  Live → Stable
```

`Stable` is only safe-to-start because publishing a *future* week means no client
can start it until the plan reaches that week (existing `PlanWeekCalculator` logic
is unchanged). The lock is a gate in front of the *content edit*, not the
publish/visibility flow.

## 4. Storage mechanism

The lock state lives in a **dedicated collection**, `SessionLock`, NOT on the
embedded `TrainingSession`. Putting it on the embedded session would force every
lock/start to rewrite the whole plan document, collide with the plan-level
`Version` (a trainer unlocking session A would false-conflict with a client
starting session B), and require clients to hold write access to the plan document
(they do not today).

```csharp
// Domain/Documents/SessionLock.cs
public class SessionLock
{
    [BsonId] public ObjectId Id { get; set; }
    [BsonElement("sessionId")] public Guid SessionId { get; set; }   // unique index
    [BsonElement("planId")]    public Guid PlanId { get; set; }
    [BsonElement("clientId")]  public Guid ClientId { get; set; }    // plan's client (for SignalR fan-out)
    [BsonElement("trainerId")] public Guid TrainerId { get; set; }
    [BsonElement("holder")]    public LockHolder Holder { get; set; } // Coach | Client
    [BsonElement("type")]      public LockType Type { get; set; }     // Editing | Live
    [BsonElement("acquiredAt")] public DateTime AcquiredAt { get; set; }
    [BsonElement("expiresAt")] public DateTime ExpiresAt { get; set; } // TTL index
}
```

- **`Stable` = no document exists.** A lock doc exists only while `Editing` or `Live`.
- **Acquire = `InsertOneAsync`.** A **unique index on `sessionId`** is the mutual
  exclusion: if the other party already holds the session, the insert throws
  `MongoWriteException` with `E11000` (duplicate key) → translate to `409`.
- **Release = `DeleteOneAsync`** filtered by `sessionId` + holder/type guard.
- **`expiresAt` carries a TTL index** (`expireAfterSeconds: 0`) → Mongo deletes the
  doc when `expiresAt` passes → state auto-reverts to `Stable` with no code.

This keeps the protocol completely off the hot plan document and off the existing
optimistic-concurrency path. The two mechanisms are complementary: plan `Version`
guards trainer-vs-trainer; `SessionLock` guards trainer-vs-client.

### Indexes
- `{ sessionId: 1 }` **unique** — mutual exclusion.
- `{ expiresAt: 1 }` with `expireAfterSeconds: 0` — TTL auto-release.
- `{ clientId: 1 }` / `{ planId: 1 }` — fan-out reads for badges.

## 5. Endpoint changes

### Backend service
`ISessionLockService` (boundary-injected, `Domain/Interfaces` + `Infrastructure/Services`):
- `AcquireAsync(sessionId, planId, clientId, trainerId, holder, type, ttl)` →
  `Result<SessionLock>` (E11000 → `LockConflict`).
- `ReleaseAsync(sessionId, holder, type)` → idempotent delete.
- `RefreshAsync(sessionId, type, ttl)` → slide `expiresAt` forward (live-session
  keep-alive).
- `GetStateAsync(sessionIds[])` → batch state resolution for read endpoints.

### New / changed endpoints
- `POST /training/plans/{planId}/sessions/{sessionId}/unlock` — trainer acquires
  `Editing`. 409 if `Live`.
- `POST /training/plans/{planId}/sessions/{sessionId}/relock` — trainer releases
  `Editing` (explicit; also auto-released by a successful save). 
- `PublishTrainingWeek` — unchanged transitions; ensures no stale lock docs for the
  week's sessions (defensive cleanup).
- `UpdateTrainingPlan` (`PUT /training/plans/{planId}`) — **diff + gate** (§6).
- `StartWorkout` (`POST /client/training/logs`) — `Stable → Live` CAS; 409 if
  `Editing`. Sets `expiresAt = now + LiveTtl`.
- `FinishWorkout` / abandon — release the `Live` lock.
- Set-logging endpoints (`MarkExerciseComplete`, set updates) — call
  `RefreshAsync` to slide the live TTL.
- `GetTodaySession` / `GetFullPlan` — include each session's lock state + holder so
  clients can render the banner.

## 6. Coach edit — diff + gate

`UpdateTrainingPlan` keeps its whole-plan, full-state PUT. On save:

1. Load the stored plan.
2. For each **published** week's session in the incoming payload, compute a
   normalized content projection (sections → exercises → sets: ids, order, name,
   notes, format/config, set prescriptions) and compare to the stored projection.
3. Build the set of **changed published sessions**.
4. For each changed published session, require an `Editing` `SessionLock` held by
   **this trainer**. If any changed published session is not `Editing` (i.e.
   `Stable` or `Live`) → reject `409` with `error_code = session_locked` and the
   offending `sessionId`s.
5. Draft weeks are freely editable — never gated.
6. On a successful save, **release** the `Editing` locks for the sessions that were
   edited (auto-relock → `Stable`) and emit the SignalR release event.

Content-equality is order-sensitive on `order` fields and value-sensitive on
prescription fields; metadata-only fields that don't affect the client view
(e.g. server timestamps) are excluded from the projection. The exact projection is
defined in the backend sub-issue.

## 7. TTL / liveness (defaults)

- **Live TTL:** sliding **6h**, refreshed on each set-log. Covers long sessions,
  releases abandoned ones.
- **Editing TTL:** **2h**, symmetric so a trainer who unlocks and wanders off does
  not block the client permanently.

Both configurable via app settings (`TrainingLock:LiveTtlHours`,
`TrainingLock:EditingTtlHours`).

## 8. Notifications (SignalR — UX skin only)

Realtime events ride on top of the authoritative state. A missed/late event never
affects correctness — the server is always the gate.

- Trainer **Unlock** → push to client: session entered `Editing`.
- Client **Start** → push to web (trainer): session entered `Live`.
- Any **release** (relock, finish, TTL) → push to the opposite party.

Event name(s) follow the lowercase convention (e.g. `sessioneditlockchanged` with a
payload of `{ planId, sessionId, state, holder }`), wired via the `signalr-event`
skill across backend → web → mobile.

## 9. Client (mobile) UX

- When a session's state is `Editing`, the session card / Today screen shows a
  warning banner: **"Your coach is updating this session — confirm before you
  start."** The Start button remains tappable (server is the gate); if the client
  taps Start and the session is `Editing`, the 409 surfaces as a toast.
- When the client successfully starts, the session enters `Live`; on
  finish/abandon it releases.
- All copy in cs/en/de.

## 10. Coach (web) UX

- A published session shows a **Unlock to edit** action. While `Editing`, the
  session content becomes editable; a **Relock** / save returns it to `Stable`.
- When a client is running a session (`Live`), the session shows an **in-progress
  badge** and the edit/unlock affordance is disabled with a tooltip: **"Client is
  training — locked for edits."**
- A gated save that hits `409 session_locked` surfaces an inline error naming the
  session(s) and offering to unlock.
- All copy in cs/en/de.

## 11. i18n

New keys land in all three locale files per package:
- Web: `web/src/i18n/locales/{cs,en,de}.json`
- Mobile: `mobile/src/i18n/locales/{cs,en,de}.json`

## 12. Out of scope (separate follow-ups)

- **Snapshot-on-start + audit history** — copying the prescription into the
  `WorkoutLog` at start for a permanent prescribed-vs-actual record.
- **Stable per-instance IDs** — replacing `exerciseExternalId`-based completion keys
  with stable per-instance Guids so swaps/duplicates can't drift completion.

Neither is required for the lock to be correct.

## 13. Testing strategy

- **Lock service unit/integration** (Testcontainers Mongo): acquire/insert E11000
  on contention; release idempotency; TTL doc expiry (simulate via past
  `expiresAt`); refresh slides `expiresAt`.
- **Endpoint integration:** Unlock fails when `Live`; Start fails when `Editing`;
  diff-gate rejects an edit to a `Stable`/`Live` published session and allows an
  `Editing` one; successful save auto-releases.
- **Concurrency:** two parallel acquires on the same session → exactly one wins.
- **Verification surface:** `dotnet build` + the changed-feature `dotnet test`
  slice; web `npm run build`; mobile `npx tsc --noEmit` + `npx expo-doctor`.

## 14. Rollout / migration

- New collection — no migration of existing data. Absence of lock docs = all
  sessions `Stable`, which is the correct default for existing published plans.
- TTL + unique indexes created on startup (index-ensure path in `MongoContext`).
- Ship behind the epic branch; no feature flag required (purely additive guard).
