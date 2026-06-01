/**
 * Hand-written TypeScript mirror of the C# SessionEditLockChangedEvent DTO.
 *
 * This event is broadcast over SignalR only (no REST endpoint), so it will not
 * appear in generated.ts.  Do NOT move these types into generated.ts — it is
 * auto-generated and write-locked.
 *
 * Source of truth:
 *   backend/FitnessPlatform.Application/Features/TrainingPlans/ (emitted at
 *   call sites: StartWorkout, CompleteWorkout, Unlock/Relock, UpdateTrainingPlan,
 *   PublishTrainingWeek)
 *
 * SignalR event name: "sessioneditlockchanged"  (hub convention: lowercase)
 *
 * Payload fields are camelCased on the wire (System.Text.Json default).
 */

/**
 * Lock state values:
 *  - "Stable"  — session is unlocked, no active editor
 *  - "Editing" — trainer has unlocked the session for editing
 *  - "Live"    — client is in an active workout session
 */
export type SessionLockState = 'Stable' | 'Editing' | 'Live';

export interface SessionEditLockChangedEvent {
  /** Training plan public identifier (MongoDB planId). */
  planId: string;

  /** Session identifier within the plan. */
  sessionId: string;

  /** New lock state after the transition. */
  state: SessionLockState;

  /**
   * Public identifier of the user who holds the lock.
   * null when state = "Stable" (no holder).
   */
  holder: string | null;
}

/**
 * Runtime type guard for `SessionEditLockChangedEvent`.
 *
 * Use this whenever consuming the raw SignalR payload to catch backend shape
 * drift early and avoid silent `undefined` access.
 */
export function isSessionEditLockChangedEvent(
  payload: unknown,
): payload is SessionEditLockChangedEvent {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Partial<Record<string, unknown>>;
  return (
    typeof p.planId === 'string' &&
    typeof p.sessionId === 'string' &&
    (p.state === 'Stable' || p.state === 'Editing' || p.state === 'Live') &&
    (p.holder === null || typeof p.holder === 'string')
  );
}
