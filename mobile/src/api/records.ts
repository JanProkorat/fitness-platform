/**
 * Personal Records API module.
 *
 * Wraps GET /client/records.
 * Types sourced from the generated client (see generated.ts — do not hand-edit).
 */
import api from './client';
import type { GetClientRecordsResponse, PersonalRecordSummary } from './generated';

// Re-export generated types so consumer imports (`from '@/api/records'`) still work.
export type { GetClientRecordsResponse, PersonalRecordSummary };

// ─── Local types ──────────────────────────────────────────────────────────────

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
    items: response.data.items ?? [],
    totalCount: isNaN(totalCount) ? 0 : totalCount,
  };
}
