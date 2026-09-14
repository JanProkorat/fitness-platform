/**
 * Hand-written TypeScript mirror of the C# TrainingProgressUpdatedEvent DTO.
 *
 * This event is broadcast over SignalR only (no REST endpoint), so it will not
 * appear in generated.ts.  Do NOT move these types into generated.ts — it is
 * auto-generated and write-locked.
 *
 * Source of truth:
 *   backend/FitnessPlatform.Application/Features/ClientTraining/TrainingProgressUpdatedEvent.cs
 *
 * SignalR event name: "trainingprogressupdated"  (hub convention: lowercase)
 */

export interface TrainingProgressUpdatedEvent {
  /** The client's public identifier (MongoDB clientId / ApplicationUser.Id as a string). */
  clientId: string;

  /**
   * The session that was mutated.
   * null for MarkWholeDayComplete where multiple sessions may have been updated.
   */
  sessionId: string | null;

  /** The calendar date for which the completion was recorded (ISO date YYYY-MM-DD). */
  date: string;

  /**
   * How many exercises in the session are now marked complete.
   * For multi-session operations (MarkWholeDayComplete) this reflects the
   * aggregate count across all sessions updated in the request.
   */
  completedExerciseCount: number;

  /**
   * Total number of exercises in the session (from the plan).
   * For multi-session operations this reflects the aggregate total.
   */
  totalExerciseCount: number;

  /**
   * Whether every exercise in the session is now complete.
   * For multi-session operations this is true only when all sessions are fully complete.
   */
  sessionComplete: boolean;

  /** Combined compliance percentage for the client today (training + nutrition weighted). */
  newCompliancePercent: number;

  /** Current consecutive-day streak for the client. */
  newStreak: number;

  /** Number of training sessions the client has fully completed today. */
  sessionsCompletedToday: number;

  /** Number of training sessions planned for the client today. */
  sessionsPlannedToday: number;

  /**
   * The workout (superset / circuit) that was mutated, if the operation was
   * workout-scoped.  Absent when the operation targeted a whole session or day.
   */
  workoutId?: string;

  /**
   * Whether every exercise in the workout is now complete.
   * Only present when `workoutId` is also present.
   */
  workoutComplete?: boolean;
}

/**
 * Runtime type guard for `TrainingProgressUpdatedEvent`.
 *
 * Use this whenever consuming the raw SignalR payload to catch backend shape
 * drift early and avoid silent `undefined` access.
 */
export function isTrainingProgressUpdatedEvent(
  payload: unknown,
): payload is TrainingProgressUpdatedEvent {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Partial<Record<keyof TrainingProgressUpdatedEvent, unknown>>;
  return (
    typeof p.clientId === 'string' &&
    (p.sessionId === null || typeof p.sessionId === 'string') &&
    typeof p.date === 'string' &&
    typeof p.completedExerciseCount === 'number' &&
    typeof p.totalExerciseCount === 'number' &&
    typeof p.sessionComplete === 'boolean' &&
    typeof p.newCompliancePercent === 'number' &&
    typeof p.newStreak === 'number' &&
    typeof p.sessionsCompletedToday === 'number' &&
    typeof p.sessionsPlannedToday === 'number' &&
    // Optional workout-level fields — validate only when present
    (p.workoutId === undefined || typeof p.workoutId === 'string') &&
    (p.workoutComplete === undefined || typeof p.workoutComplete === 'boolean')
  );
}
