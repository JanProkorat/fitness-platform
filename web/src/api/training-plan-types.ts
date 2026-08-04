/** Set type enum values. */
export type SetType = 'Normal' | 'Warmup' | 'Dropset' | 'Superset';

/**
 * Workout format / scoring methodology for a session or exercise.
 * Mirrors backend WorkoutFormat enum.
 */
export type WorkoutFormat = 'Standard' | 'ForTime' | 'AMRAP' | 'EMOM' | 'Tabata';

/**
 * How performance in an exercise is measured.
 * Mirrors backend MovementType enum.
 */
export type MovementType = 'Reps' | 'Time' | 'Distance' | 'RepsForTime';

/**
 * Configuration parameters for a WOD format.
 * Only fields relevant to the chosen format are expected to be set.
 */
export interface WodConfig {
  timeCapSeconds?: number | null;
  intervalSeconds?: number | null;
  totalRounds?: number | null;
  workSeconds?: number | null;
  restSeconds?: number | null;
}

/**
 * Records the outcome of a WOD format session or exercise.
 * Only fields relevant to the actual result need to be set.
 */
export interface WodResult {
  roundsCompleted?: number | null;
  extraReps?: number | null;
  totalTimeSeconds?: number | null;
  failedRounds?: number[] | null;
  repsByRound?: number[] | null;
}

/** A single set within an exercise. */
export interface ExerciseSet {
  setNumber: number;
  type: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
}

/** An exercise within a training session (denormalized snapshot). */
export interface SessionExercise {
  /**
   * Instance identifier for this specific exercise entry within its session —
   * distinguishes two occurrences of the same catalog exercise
   * (`exerciseExternalId`) programmed twice, or once standalone and once
   * nested in a workout of the same session. Always present on read.
   * Must be round-tripped on save via `UpdateSessionExerciseRequest.exerciseId`
   * — omitting it re-mints the instance id server-side and orphans any
   * exercise-level completion state keyed by it.
   */
  exerciseId: string;
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
  /** How performance for this exercise is measured. Defaults to Reps. */
  movementType: MovementType;
  /** Per-exercise format override. Null means inherit session format. */
  format?: WorkoutFormat | null;
  /** Per-exercise format config. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
  sets: ExerciseSet[];
}

/**
 * An ordered workout within a training session (e.g. "Warm-up", "Hlavní") —
 * a block of exercises. A session can hold multiple workouts, each with its
 * own exercises.
 */
export interface TrainingWorkout {
  /** Stable client-side identifier; reused across saves. New workouts get crypto.randomUUID(). */
  workoutId: string;
  /** Display order within the session (0-based). */
  order: number;
  /** Display name (e.g. "Hlavní", "Rozcvička"). */
  name: string;
  /** Workout-level format. Null means inherit the session-level format. */
  format?: WorkoutFormat | null;
  /** Format config. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
  /** Optional coach notes for this workout. */
  notes?: string | null;
  /** Exercises in this workout. */
  exercises: SessionExercise[];
}

/**
 * A training session's workout/exercise fields, shared by both the raw wire
 * shape (nested under a day) and the flattened internal/store shape (see
 * `TrainingSession` below).
 */
export interface TrainingSessionWorkoutFields {
  sessionId: string;
  name: string;
  order: number;
  notes?: string | null;
  /** Session-level workout format (kept as inheritable default). */
  format: WorkoutFormat;
  /** Session-level format config. */
  formatConfig?: WodConfig | null;
  /** Workouts in this session. Each workout contains its own exercises. */
  workouts: TrainingWorkout[];
  /**
   * Standalone exercises directly on this session — not grouped under any
   * workout (e.g. a single finisher movement). Persisted, read/write.
   */
  standaloneExercises: SessionExercise[];
  /**
   * Flat, computed, READ-ONLY view of every exercise in this session —
   * `standaloneExercises` plus every workout's nested exercises. Present on
   * API response objects only. MUST NEVER be sent back as
   * `standaloneExercises` on save — doing so persists every nested workout
   * exercise a second time and compounds on every subsequent save.
   */
  allExercises: SessionExercise[];
}

/**
 * A training session exactly as the backend serves it — nested under a
 * `RawTrainingDay`, no `dayOfWeek` of its own (the parent day owns it).
 * Consumed only at the API boundary (`training-plans.ts` return types) and
 * flattened into `TrainingSession` by `trainingPlan.ts`'s `setPlan`.
 */
export type RawTrainingSession = TrainingSessionWorkoutFields;

/**
 * A single day within a training week (1 = Monday … 7 = Sunday) exactly as
 * the backend serves it. Every week materializes all 7 days — a rest day is
 * a day with zero sessions.
 */
export interface RawTrainingDay {
  /** Day of the week (1 = Monday, 7 = Sunday). */
  dayOfWeek: number;
  /** Training sessions scheduled for this day. */
  sessions: RawTrainingSession[];
  /** Optional coach note for this day. */
  note?: string | null;
}

/** A week within the training plan, exactly as the backend serves it. */
export interface RawTrainingWeek {
  weekNumber: number;
  status: 'Draft' | 'Published';
  datePublished?: string | null;
  /** Days in this week. Always 7 entries (Monday through Sunday). */
  days: RawTrainingDay[];
}

/**
 * A training session as used throughout the store and UI — flattened back
 * out of the wire's per-day nesting, with `dayOfWeek` restored directly on
 * the session (mirrors the shape this app's editor has always worked with).
 * Built by `trainingPlan.ts`'s `setPlan` from a `RawTrainingSession` plus its
 * parent `RawTrainingDay.dayOfWeek`; the flat internal shape is intentional —
 * only the GET-hydration edge needs to unnest the wire's `days[]`, the write
 * edge (`UpdateTrainingWeekRequest`) is already flat.
 */
export interface TrainingSession extends TrainingSessionWorkoutFields {
  dayOfWeek: number;
}

/**
 * A week within the training plan as used throughout the store and UI —
 * flat `sessions[]` (not nested under days) plus a `dayNotes` map keyed by
 * day-of-week, matching the shape of `UpdateTrainingWeekRequest` almost
 * 1:1 so `save()` barely needs to transform it.
 */
export interface TrainingWeek {
  weekNumber: number;
  status: 'Draft' | 'Published';
  datePublished?: string | null;
  sessions: TrainingSession[];
  dayNotes?: Record<number, string> | null;
}

/**
 * One completion record produced by the mobile client when the user marks
 * exercises complete. Surfaces (date, session, completed-exerciseIds) tuples
 * so the trainer editor can lock fields the client has already finished.
 */
export interface TrainingPlanCompletion {
  /** Calendar date the completion applies to (ISO yyyy-mm-dd). */
  date: string;
  sessionId: string;
  /**
   * @deprecated Use `completedExerciseIdsByWorkout` instead. Kept for one
   * release while the backend emits both fields. When `completedExerciseIdsByWorkout`
   * is present, this flat list is ignored by lock derivation.
   */
  completedExerciseIds: string[];
  /**
   * Per-workout completion map: key = workoutId, value = exerciseExternalIds
   * completed within that workout. Prefer this over the deprecated flat
   * `completedExerciseIds` field.
   */
  completedExerciseIdsByWorkout?: Record<string, string[]>;
  /**
   * Workout IDs the client has marked done at the workout level (used for
   * workouts without exercises, e.g. ForTime "Running" workouts).
   */
  completedWorkoutIds: string[];
  version: number;
}

/**
 * Per-set actual + snapshot-planned values and the backend-computed isModified flag.
 * Sourced from a WorkoutSet document. Key fields are null for legacy sets without
 * snapshot storage — treat as planned == actual / isModified == false.
 *
 * Hand-written (not from generated.ts) — the plan response is consumed via the
 * hand-written TrainingPlanDetail type, not the NSwag-generated client.
 */
export interface LoggedSetDto {
  /** 1-based set number within the exercise. */
  setNumber: number;

  // ── Actual logged values ─────────────────────────────────────────────────────
  /** Actual repetitions logged. Null when the set has not been performed. */
  actualReps: number | null;
  /** Actual weight (kg) logged. Null when not performed. */
  actualWeightKg: number | null;
  /** Actual RPE logged. Null when not performed. */
  actualRpe: number | null;
  /** Actual duration (seconds) logged. Null when not performed. */
  actualDurationSeconds: number | null;
  /** Actual distance (meters) logged. Null when not performed. */
  actualDistanceMeters: number | null;

  // ── Snapshot-planned values ──────────────────────────────────────────────────
  // Frozen at log time from the plan prescription.
  // Null on legacy documents that pre-date snapshot storage.
  /** Snapshot-planned repetitions at log time. Null for legacy logs. */
  plannedReps: number | null;
  /** Snapshot-planned weight (kg) at log time. Null for legacy logs. */
  plannedWeightKg: number | null;
  /** Snapshot-planned RPE at log time. Null for legacy logs. */
  plannedRpe: number | null;
  /** Snapshot-planned duration (seconds) at log time. Null for legacy logs. */
  plannedDurationSeconds: number | null;
  /** Snapshot-planned distance (meters) at log time. Null for legacy logs. */
  plannedDistanceMeters: number | null;

  /**
   * Backend-computed flag: true when any actual field differs from its snapshot-planned
   * counterpart. Always false for legacy sets (no snapshot → treated as planned == actual).
   */
  isModified: boolean;
}

/**
 * Per-workout finished state as reported by the backend on the SessionExecutionDto.
 * A workout is finished when either:
 *   - The session-level WorkoutLog is completed (IsSessionFinished = true), OR
 *   - The TrainingCompletion document records this specific workout as finished
 *     (MarkWorkoutComplete path — workout-grain completion without a full log).
 *
 * The web layer uses this to render the per-workout "finished" label and disable
 * editing on workouts that the client has completed, independently of the session-
 * level IsSessionFinished flag.
 *
 * Hand-written (not from generated.ts) — mirrors the C# WorkoutFinishedStateDto.
 */
export interface WorkoutFinishedStateDto {
  /** The workoutId this finished state belongs to. Matches TrainingWorkout.workoutId. */
  workoutId: string;
  /**
   * Whether this workout is finished.
   * True when IsSessionFinished is true (session-level completion implies every workout
   * is done), OR when the TrainingCompletion document shows this workout as complete.
   */
  isFinished: boolean;
}

/**
 * Per-session workout-log execution data returned by the trainer endpoint.
 * Used to derive completed / skipped / not-yet-reached states per set.
 *
 * Disambiguation rule (derived, never stored):
 * - completed     → set's 1-based index is in completedSetsByExercise[exerciseId]
 * - skipped       → isSessionFinished=true AND the index is NOT in the list
 * - not-yet-reached → isSessionFinished=false (or no row for this session)
 */
export interface SessionExecutionDto {
  /** Matches TrainingSession.sessionId */
  sessionId: string;
  /** True when the client finalised the workout log (WorkoutLog.IsCompleted). */
  isSessionFinished: boolean;
  /**
   * @deprecated Use `completedSetsByWorkoutAndExercise` for workout-aware lookup.
   *
   * Key = exerciseExternalId (matches SessionExercise.exerciseExternalId).
   * Value = sorted list of 1-based set numbers that were stamped as complete.
   * An absent key means no sets for that exercise were logged.
   *
   * When the same exercise appears in multiple workouts, this map reflects only the
   * last-workout-wins entry (legacy flattened view). Prefer `completedSetsByWorkoutAndExercise`.
   */
  completedSetsByExercise: Record<string, number[]>;
  /**
   * @deprecated Use `loggedSetsByWorkoutAndExercise` for workout-aware lookup.
   *
   * Key = exerciseExternalId (matches SessionExercise.exerciseExternalId).
   * Value = list of LoggedSetDto (one per logged set), carrying actual values,
   * snapshot-planned values, and the isModified flag.
   * An absent key means no sets for that exercise were logged.
   *
   * When the same exercise appears in multiple workouts, this map reflects only the
   * last-workout-wins entry. Prefer `loggedSetsByWorkoutAndExercise`.
   */
  loggedSetsByExercise: Record<string, LoggedSetDto[]>;
  /**
   * Workout-aware completed sets map.
   * Key = "{workoutId}:{exerciseExternalId}" composite string.
   * Value = sorted list of 1-based set numbers that were stamped as complete.
   *
   * An absent key means no sets for that exercise in that workout were logged.
   * Use this in preference to `completedSetsByExercise` to avoid cross-workout collisions
   * (e.g. the same exercise appearing in both a Standard and an AMRAP workout).
   *
   * Absent on responses from backends that pre-date this field — fall back to
   * `completedSetsByExercise` when the map is missing or the composite key is absent.
   */
  completedSetsByWorkoutAndExercise?: Record<string, number[]>;
  /**
   * Workout-aware logged sets map.
   * Key = "{workoutId}:{exerciseExternalId}" composite string.
   * Value = list of LoggedSetDto (one per logged set).
   *
   * An absent key means no sets for that exercise in that workout were logged.
   * Use this in preference to `loggedSetsByExercise` to avoid cross-workout collisions.
   *
   * Absent on responses from backends that pre-date this field — fall back to
   * `loggedSetsByExercise` when the map is missing or the composite key is absent.
   */
  loggedSetsByWorkoutAndExercise?: Record<string, LoggedSetDto[]>;
  /**
   * True when at least one set in any exercise under this session has isModified === true.
   * The web layer uses this to show the "upraveno" badge at the session-header level.
   * Always false when the session has no WorkoutLog (or all logs are legacy without snapshots).
   */
  hasModifications: boolean;
  /**
   * Per-workout finished state for all workouts in this session.
   * Populated by the endpoint from both WorkoutLog and TrainingCompletion signals.
   * A workout is finished when IsSessionFinished is true (session-level completion
   * implies every workout is done), OR when the TrainingCompletion document records
   * that specific workout as complete via the MarkWorkoutComplete path.
   * Empty array (or absent) for sessions with no completion data.
   *
   * The web layer uses this to render the per-workout "finished" label and disable
   * editing on completed workouts independently of the session-level finished state.
   */
  finishedWorkouts?: WorkoutFinishedStateDto[];
}

/**
 * Edit-lock state of a single training session as reported by the backend.
 *
 * Mirrors the C# SessionLockStateDto in GetTrainingPlanResponse.
 * Only sessions with an active (non-expired) lock appear in
 * `TrainingPlanDetail.sessionLockStates`; absent sessions are implicitly "Stable".
 *
 * Hand-written (not from generated.ts) — the plan response is consumed via the
 * hand-written `TrainingPlanDetail` type, not the NSwag-generated client.
 */
export interface SessionLockStateDto {
  /** The session this lock state belongs to. Matches TrainingSession.sessionId. */
  sessionId: string;
  /**
   * Current edit-lock state.
   *   "Stable"  — no active lock; fully editable.
   *   "Editing" — trainer holds an Editing lock (after calling Unlock).
   *   "Live"    — client has an active workout; editing is blocked.
   */
  lockState: 'Stable' | 'Editing' | 'Live';
  /**
   * Who currently holds the lock. Null when lockState is "Stable".
   *   "Coach" — trainer holds the Editing lock.
   *   "Client" — client holds the Live lock.
   */
  lockHolder: 'Coach' | 'Client' | null;
}

/**
 * Fields shared by the raw wire training-plan response and the flattened
 * internal/store shape — everything except `weeks`, whose element shape
 * differs (nested `days[]` on the wire vs. flat `sessions[]` internally).
 */
export interface TrainingPlanDetailFields {
  planId: string;
  clientId: string;
  trainerId: string;
  name: string;
  description?: string | null;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  /** Per-(date,session) completion records — one entry per (date, sessionId). */
  completions?: TrainingPlanCompletion[];
  /**
   * Per-session workout-log execution data for the plan's client.
   * One entry per session that has at least one WorkoutLog record.
   * Sessions with no entry are treated as fully not-yet-reached.
   */
  sessionExecutions?: SessionExecutionDto[];
  /**
   * Per-session edit-lock state at load time. Only sessions with an active
   * (non-expired) lock appear here; absent sessions are implicitly "Stable".
   * The store mirrors this into a Map keyed by sessionId for O(1) lookup.
   * SignalR `sessioneditlockchanged` events patch the map while the page is open.
   */
  sessionLockStates?: SessionLockStateDto[];
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
  startDate?: string | null;
  dateCompleted?: string | null;
  questionnaireResponseId?: string | null;
}

/**
 * Full training plan detail exactly as the backend serves it — `weeks[]`
 * nests sessions under days. Returned by the `training-plans.ts` API
 * functions; `trainingPlan.ts`'s `setPlan` is the only place that should
 * consume this directly, flattening it into `TrainingPlanDetail`.
 */
export interface RawTrainingPlanDetail extends TrainingPlanDetailFields {
  weeks: RawTrainingWeek[];
}

/**
 * Full training plan detail as used throughout the store and UI — `weeks[]`
 * stays flat (see `TrainingWeek`). This is the shape every training
 * component (`TrainingPlanPage`, `TrainingSidebar`, `SectionCard`, etc.)
 * consumes; it is NOT the literal wire shape (see `RawTrainingPlanDetail`).
 */
export interface TrainingPlanDetail extends TrainingPlanDetailFields {
  weeks: TrainingWeek[];
}

/** Training plan summary for list views. */
export interface TrainingPlanSummary {
  planId: string;
  name: string;
  description?: string | null;
  clientId: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  weekCount: number;
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
  startDate?: string | null;
  dateCompleted?: string | null;
  questionnaireResponseId?: string | null;
}

/** Paginated training plan list response. */
export interface GetTrainingPlansResponse {
  plans: TrainingPlanSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to create a new training plan. */
export interface CreateTrainingPlanRequest {
  clientId: string;
  name: string;
  description?: string | null;
  weekCount?: number;
  startDate?: string | null;
  questionnaireResponseId?: string | null;
}

/** Request to update a training plan (full state). */
export interface UpdateTrainingPlanRequest {
  name: string;
  description?: string | null;
  weeks: UpdateTrainingWeekRequest[];
  version: number;
  startDate?: string | null;
}

/**
 * Week data within a full-state plan update. Stays FLAT on the wire — unlike
 * the nested read shape (`TrainingWeek.days[].sessions[]`), the write DTO
 * keeps `sessions` at the week level and rebuilds day notes into a map keyed
 * by day-of-week (1..7).
 */
export interface UpdateTrainingWeekRequest {
  weekNumber: number;
  sessions: UpdateSessionRequest[];
  dayNotes?: Record<number, string> | null;
}

/** Workout data within a session update. */
export interface UpdateWorkoutRequest {
  /** Stable workout identifier. Pass the existing ID to preserve identity across saves. New GUID generated if null. */
  workoutId?: string | null;
  /** Display order within the session (0-based). */
  order: number;
  /** Display name of the workout (e.g. "Hlavní", "Warm-up"). */
  name: string;
  /** Workout format. Null means inherit the session-level format. */
  format?: WorkoutFormat | null;
  /** Format configuration. Null when format is null or Standard. */
  formatConfig?: WodConfig | null;
  /** Optional coach note for this workout. */
  notes?: string | null;
  /** Exercises belonging to this workout. */
  exercises: UpdateSessionExerciseRequest[];
}

/** Session data within a full-state plan update. */
export interface UpdateSessionRequest {
  sessionId?: string | null;
  dayOfWeek: number;
  name: string;
  order: number;
  notes?: string | null;
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  /** Ordered workouts in this session. Each workout contains its own exercises. */
  workouts: UpdateWorkoutRequest[];
  /**
   * Standalone exercises directly on this session — not grouped under any
   * workout. Shares one ordering sequence with `workouts`.
   */
  standaloneExercises: UpdateSessionExerciseRequest[];
}

/** Exercise data within a session update. */
export interface UpdateSessionExerciseRequest {
  /**
   * Optional existing instance identifier for this exercise entry. New GUID
   * generated server-side if null/omitted — always send the value read from
   * `SessionExercise.exerciseId` to preserve identity (and any exercise-level
   * completion state keyed by it) across saves.
   */
  exerciseId?: string | null;
  exerciseExternalId: string;
  exerciseName: string;
  order: number;
  notes?: string | null;
  restSeconds?: number | null;
  movementType: MovementType;
  format?: WorkoutFormat | null;
  formatConfig?: WodConfig | null;
  sets: UpdateExerciseSetRequest[];
}

/** Set data within an exercise update. */
export interface UpdateExerciseSetRequest {
  setNumber: number;
  type: SetType;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
}

/** Exercise progress data point. */
export interface ExerciseProgressPoint {
  date: string;
  bestWeightKg?: number | null;
  bestReps?: number | null;
  totalVolume: number;
  hasPR: boolean;
}

/** Exercise progress response. */
export interface ExerciseProgressResponse {
  exerciseName: string;
  dataPoints: ExerciseProgressPoint[];
}
