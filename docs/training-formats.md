# Training formats — reference

Each session and each exercise can carry a `WorkoutFormat`. The format
controls **how the workout is run live** (timer, scoring) and **what the
client logs** (per-set values vs. round-level outcome). This page is the
trainer-facing reference: what each format means, what to configure, and
what the mobile app captures when the client finishes.

The data lives in the backend's `Domain/Documents/`:

- `TrainingSession.Sections` (`List<TrainingSection>`) — ordered sections
  (see [Sections](#sections)).
- `TrainingSection.Format` (`WorkoutFormat?`) +
  `TrainingSection.FormatConfig` (`WodConfig?`) — section-wide. `null`
  means "inherit from session".
- `TrainingSession.Format` + `TrainingSession.FormatConfig` — session-wide
  defaults inherited by sections that leave their own `Format` null. Kept
  nullable for one release as a back-compat handle while plans migrate
  to per-section formats.
- `SessionExercise.Format` (`WorkoutFormat?` — `null` means "inherit from
  section") + `SessionExercise.FormatConfig`.
- `SessionExercise.MovementType` (`MovementType`) — controls the set-table
  columns.
- `WorkoutLog.Sections` (`List<WorkoutSection>`) + each section's
  `WorkoutExercise.WodResult` (`WodResult?`) — outcome captured at the
  end of the live workout, keyed by section.

Format inheritance flows session → section → exercise. Per-exercise
format overrides section format; section format overrides session
format. A `Standard` section with one `EMOM` exercise will run that
exercise as a single-exercise WOD inside an otherwise reps×weight
section.

---

## Sections

A training session is a list of **sections**. Each section carries its
own format and config and groups the exercises that run under that
format. The mobile live runner advances one section at a time
(prestart → section-runner → running → finished); the trainer portal
authors plans as sections, with format chips and accent bars matching
the mobile bands.

- **`TrainingSession.Sections: List<TrainingSection>`** — ordered by
  `TrainingSection.Order`. A session always has ≥1 section. Legacy plans
  stored without sections materialize on read as a single default
  section named `Hlavní` wrapping the flat exercises (no data
  migration; pure schema-on-read backfill in
  `TrainingSession.WithBackfilledSections()`). The same backfill
  applies to legacy `WorkoutLog` documents
  (`WorkoutLog.Sections` / `WorkoutSection`).
- **`TrainingSection`** — embedded sub-document, not a root aggregate.
  Fields: `SectionId` (Guid, client-side stable), `Order` (int), `Name`
  (string — e.g. `"Hlavní"`, `"Warm-up"`, `"Cool-down"`), `Format`
  (`WorkoutFormat?`), `FormatConfig` (`WodConfig?`), `Exercises`
  (`List<SessionExercise>`).
- **Per-exercise overrides** still apply within a section — a
  `Conditioning` section running AMRAP can host one `Standard` exercise
  by setting that exercise's `Format = Standard`.

### Section templates

Reusable section blueprints live in their own collection
(`Domain/Documents/SectionTemplate.cs`, root aggregate with
`Id` / `ExternalId` / `Version` / audit fields and per-trainer
ownership via `OwnerTrainerId`). Trainers create templates in the
**Šablony sekcí** admin page in the portal and apply them to any
in-progress session — selection splices the template's
`DefaultFormat`, `DefaultFormatConfig`, and `DefaultExercises` into
the active section, then the trainer saves the plan through the
standard `UpdateTrainingPlan` flow.

Endpoints (`Features/SectionTemplates/`, all trainer-only auth):

- `POST /training/section-templates` — create
- `GET  /training/section-templates` — list (own templates only)
- `GET  /training/section-templates/{templateId}` — get
- `PUT  /training/section-templates/{templateId}` — update
  (optimistic concurrency on `Version`)
- `DELETE /training/section-templates/{templateId}` — delete

Cross-trainer access returns `403 Forbidden`; missing template returns
`404 Not Found`.

---

## Standard

The default format. No timer, no round counting — the client logs each
set with reps × weight (or whatever the `MovementType` requires).

- **`WodConfig`:** must be `null`. The validator rejects a config payload
  when format is `Standard`.
- **`WodResult`:** not used; remains `null` on `WorkoutLog`.
- **Set-table columns:** controlled by `MovementType` (see [Movement types](#movement-types)).
- **Mobile flow:** the existing per-set runner (`LiveExerciseFocus` /
  `TimedExerciseFocus`) — one exercise at a time, advance after each set.

## EMOM — Every Minute on the Minute

The client starts a new round at fixed intervals. Missing the round in
time is a "fail this minute"; the workout still continues.

- **`WodConfig` — required fields:**
  - `IntervalSeconds` (> 0) — usually `60`.
  - `TotalRounds` (> 0) — how many minutes the workout runs.
- **`WodConfig` — optional:** none.
- **`WodResult` — captured fields:**
  - `RoundsCompleted` — total minutes the client successfully landed.
  - `FailedRounds` — list of 1-based round indices the client missed.
- **Mobile flow:** `WodTimerHero` (EMOM branch). Bell + haptic on each
  interval boundary; a "Fail this minute" button records the index into
  `FailedRounds`. Outcome-only logging — no per-rep capture mid-round.

## AMRAP — As Many Rounds As Possible

A fixed time cap; the client cycles through the prescribed exercises and
counts rounds. Partial round at the end captured as "extra reps".

- **`WodConfig` — required fields:**
  - `TimeCapSeconds` (> 0) — total work time.
- **`WodConfig` — optional:** none.
- **`WodResult` — captured fields:**
  - `RoundsCompleted` — full rounds finished before the cap.
  - `ExtraReps` — reps beyond the last full round (a single integer; no
    per-exercise breakdown — see "outcome-only logging").
- **Mobile flow:** `WodTimerHero` (AMRAP branch). Big tap-to-bump round
  counter and an extra-reps stepper that becomes active in the final
  rep-ratio of the time cap. Single FINISH at the cap.

## Tabata

Eight rounds of 20s work / 10s rest by default. Each round may track a
total reps figure across the working interval.

- **`WodConfig` — required fields:**
  - `WorkSeconds` (> 0) — usually `20`.
  - `RestSeconds` (> 0) — usually `10`.
  - `TotalRounds` (> 0) — usually `8`.
- **`WodConfig` — optional:** none.
- **`WodResult` — captured fields:**
  - `RoundsCompleted` — number of rounds fully worked through.
  - `RepsByRound` — list of integer rep counts, one per round (length
    equal to `RoundsCompleted`). Optional — may be empty when the client
    chooses not to log per-round reps.
- **Mobile flow:** `WodTimerHero` (Tabata branch). Distinct work / rest
  visuals; haptic on each phase change; an optional reps-per-round field
  the client can advance during the rest interval.

## ForTime

Fixed work, race the clock. The client finishes when all prescribed
work is complete.

- **`WodConfig` — required fields:**
  - `TimeCapSeconds` (> 0) — hard cap; the timer auto-stops at this point.
- **`WodConfig` — optional:** none.
- **`WodResult` — captured fields:**
  - `TotalTimeSeconds` — elapsed time at the moment the client tapped
    FINISH (or the cap, whichever came first).
- **Mobile flow:** `WodTimerHero` (ForTime branch). Single big FINISH
  button; count-up timer.

---

## Movement types

`MovementType` lives on `SessionExercise` and controls the **set-table
columns** (in the trainer portal authoring view AND the mobile per-set
runner). It is independent of `WorkoutFormat` — a `Standard` session
with `MovementType.Time` exercises runs the existing per-set flow but
the set table swaps columns; an `AMRAP` session with `MovementType.Reps`
exercises shows reps in the round-counter context.

| `MovementType` | Set-table columns | Mobile capture | Logged on `WorkoutSet` |
|---|---|---|---|
| `Reps` | weight + reps + rest | reps × weight stepper | `Reps`, `WeightKg`, `RestSeconds` |
| `Time` | duration + rest | count-down timer (or count-up for free durations) | `DurationSeconds`, `RestSeconds` |
| `Distance` | distance + duration + rest | distance numeric entry + duration timer | `DistanceMeters`, `DurationSeconds`, `RestSeconds` |
| `RepsForTime` | reps + rest | reps stepper inside a section-level time cap | `Reps`, `RestSeconds` |

`addSet` on the trainer authoring side defaults the new row's fields to
match the parent's `MovementType` — a Time exercise's "Add set" doesn't
prompt for weight, a Distance exercise's "Add set" prompts for meters.

The mobile `buildRequest()` reads each set's `MovementType` and emits
the matching fields onto `UpdateWorkoutSetRequest` — `DurationSeconds`
for Time, `DistanceMeters` for Distance, `Reps` + `WeightKg` for Reps.

---

## Outcome-only logging

For all four WOD formats (`EMOM` / `AMRAP` / `Tabata` / `ForTime`) the
mobile app captures **only the round-level outcome**, never per-rep
detail mid-round. Trainers can adjust prescribed reps per round in the
plan, but the client logs at the round boundary — round counter bumps,
fail toggles, extra reps tally — and the final `WodResult` lands on the
log when the client finalizes the workout (`finalizeWod`).

This keeps the live UI simple and matches how AMRAP / EMOM / Tabata are
scored in actual training contexts.

---

## Backend invariants

The `UpdateTrainingPlan` validator (`Features/TrainingPlans/UpdateTrainingPlan/`)
enforces these at write time. Failing them returns `400 Bad Request` with
RFC 7807 Problem Details. **The validator now operates per-section, not
per-session** — every section's `Format` / `FormatConfig` is checked
independently, and the same rules apply at the per-exercise level when
`SessionExercise.Format` is non-null. The `CreateSectionTemplate` and
`UpdateSectionTemplate` validators apply the same rules to template
defaults.

- `EMOM` — `IntervalSeconds > 0` AND `TotalRounds > 0`.
- `AMRAP` / `ForTime` — `TimeCapSeconds > 0`.
- `Tabata` — `WorkSeconds > 0` AND `RestSeconds > 0` AND `TotalRounds > 0`.
- `Standard` — `FormatConfig` MUST be `null`.

Additional section-level invariants:

- A session must contain ≥1 section.
- Each section's `Order` is unique within the session.

Existing plans created before the format / section work was added
continue to load unchanged: the Mongo schema-on-read plus C# property
defaults (`Sections = [{ Hlavní }]` from the legacy flat `Exercises`,
`Format = Standard`, `MovementType = Reps`, nullable `FormatConfig` /
`WodResult` / per-exercise `Format`) backfill the missing fields
silently.
