/**
 * Hand-written TypeScript mirror of the C# PersonalRecordAchievedEvent DTO.
 *
 * This event is broadcast over SignalR only (no REST endpoint), so it will not
 * appear in generated.ts.  Do NOT move these types into generated.ts — it is
 * auto-generated and write-locked.
 *
 * Source of truth:
 *   backend/FitnessPlatform.Application/Features/ClientTraining/PersonalRecordAchievedEvent.cs
 *
 * SignalR event name: "personalrecordachieved"  (hub convention: lowercase)
 *
 * Payload fields are camelCased on the wire (System.Text.Json default).
 */

export interface PersonalRecordAchievedEvent {
  /** The client's public identifier (ApplicationUser.Id as a string). */
  clientId: string;

  /** The exercise's external/public identifier. */
  exerciseExternalId: string;

  /** Localised display name of the exercise. */
  exerciseName: string;

  /** Weight lifted in kilograms. */
  weightKg: number;

  /** Number of repetitions performed. */
  reps: number;

  /** ISO 8601 timestamp when the record was set. */
  achievedAt: string;
}

/**
 * Runtime type guard for `PersonalRecordAchievedEvent`.
 *
 * Use this whenever consuming the raw SignalR payload to catch backend shape
 * drift early and avoid silent `undefined` access.
 */
export function isPersonalRecordAchievedEvent(
  payload: unknown,
): payload is PersonalRecordAchievedEvent {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Partial<Record<keyof PersonalRecordAchievedEvent, unknown>>;
  return (
    typeof p.clientId === 'string' &&
    typeof p.exerciseExternalId === 'string' &&
    typeof p.exerciseName === 'string' &&
    typeof p.weightKg === 'number' &&
    typeof p.reps === 'number' &&
    typeof p.achievedAt === 'string'
  );
}
