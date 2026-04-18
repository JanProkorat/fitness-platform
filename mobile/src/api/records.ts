/**
 * Personal Records API module.
 *
 * Wraps GET /client/records.
 * Types are defined locally here until the backend is running and regen-api
 * can pull them into generated.ts, at which point these should be re-exported
 * from the generated file instead.
 */
import api from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Summary DTO for a single personal record. */
export interface PersonalRecordSummary {
  /** Public-facing identifier of this personal record. */
  externalId: string;
  /** ExternalId of the exercise for which the PR was achieved. */
  exerciseExternalId: string;
  /** Snapshot of the exercise name at the time the PR was achieved. */
  exerciseName: string;
  /** Weight lifted in kilograms. */
  weightKg: number;
  /** Repetitions completed in the PR set. */
  reps: number;
  /** When the personal record was achieved (UTC ISO string). */
  achievedAt: string;
  /** ExternalId of the workout log that contains this PR set. */
  workoutLogId: string;
}

/** Response body from GET /client/records. */
export interface GetClientRecordsResponse {
  items: PersonalRecordSummary[];
}

/** Parameters for {@link getPersonalRecords}. */
export interface GetPersonalRecordsParams {
  page?: number;
  pageSize?: number;
  exerciseExternalId?: string;
}

/** Extended result that includes pagination metadata read from the response header. */
export interface PersonalRecordsResult {
  items: PersonalRecordSummary[];
  /** Total count from the X-Total-Count response header. */
  totalCount: number;
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function getPersonalRecords(
  params?: GetPersonalRecordsParams,
): Promise<PersonalRecordsResult> {
  const response = await api.get<GetClientRecordsResponse>('/client/records', { params });
  const totalCount = parseInt(response.headers['x-total-count'] ?? '0', 10);
  return {
    items: response.data.items,
    totalCount: isNaN(totalCount) ? 0 : totalCount,
  };
}
