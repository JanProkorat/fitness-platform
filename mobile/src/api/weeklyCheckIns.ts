/**
 * API module for client-facing weekly check-in endpoints.
 *
 * DTOs are hand-mirrored from the C# backend because regen-api cannot run
 * without a local backend instance (MongoDB auth unavailable in CI).
 *
 * Sources:
 *   - GetCurrentClientCheckInsResponse.cs
 *   - RespondToCheckInRequest.cs / RespondToCheckInResponse.cs
 *   - DismissCheckInResponse.cs
 *   - CheckInFlag.cs (enum)
 */
import api from './client'

// ─── Enum ────────────────────────────────────────────────────────────────────

export type CheckInFlag =
  | 'Traveling'
  | 'EventOrCelebration'
  | 'SickOrLowEnergy'
  | 'InjuryOrPain'
  | 'MoreTimeAvailable'
  | 'LessTimeAvailable'

/** All flag values in display order (matches spec §5.2 chip grid). */
export const CHECK_IN_FLAGS: CheckInFlag[] = [
  'Traveling',
  'EventOrCelebration',
  'SickOrLowEnergy',
  'InjuryOrPain',
  'MoreTimeAvailable',
  'LessTimeAvailable',
]

/** Profession type string as returned by the backend. */
export type ProfessionType = 'Training' | 'Nutrition'

// ─── Response DTOs ────────────────────────────────────────────────────────────

/** A single active check-in returned by GET /client/weekly-check-ins/current. */
export interface CheckInSummary {
  id: string
  professionalUserId: string
  professionalName: string
  /** "Training" | "Nutrition" */
  profession: ProfessionType
  /** ISO date string "YYYY-MM-DD" */
  weekStartDate: string
  sentAt: string
}

export interface GetCurrentClientCheckInsResponse {
  checkIns: CheckInSummary[]
}

/** Full check-in detail used by the response sheet for read-only variant. */
export interface CheckInDetail extends CheckInSummary {
  flags: CheckInFlag[]
  note: string | null
  respondedAt: string | null
  dismissedByClientAt: string | null
  reviewedByTrainerAt: string | null
}

// ─── Request / response for respond ──────────────────────────────────────────

export interface RespondToCheckInRequest {
  flags: CheckInFlag[]
  note?: string
}

export interface RespondToCheckInResponse {
  id: string
  flags: CheckInFlag[]
  note: string | null
  respondedAt: string
}

// ─── Response for dismiss ─────────────────────────────────────────────────────

export interface DismissCheckInResponse {
  id: string
  dismissedAt: string
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * GET /client/weekly-check-ins/current
 * Returns 0–2 active (not responded, not dismissed) check-ins for this ISO week.
 */
export async function getCurrentCheckIns(): Promise<GetCurrentClientCheckInsResponse> {
  const { data } = await api.get<GetCurrentClientCheckInsResponse>(
    '/client/weekly-check-ins/current',
  )
  return data
}

/**
 * POST /client/weekly-check-ins/{id}/respond
 * Persists the client's flags and optional note.
 * Returns 409 with errorCode "CHECK_IN_ALREADY_REVIEWED" if trainer already marked reviewed.
 */
export async function respondToCheckIn(
  id: string,
  body: RespondToCheckInRequest,
): Promise<RespondToCheckInResponse> {
  const { data } = await api.post<RespondToCheckInResponse>(
    `/client/weekly-check-ins/${id}/respond`,
    body,
  )
  return data
}

/**
 * POST /client/weekly-check-ins/{id}/dismiss
 * Skips the check-in for this week; does not create a trainer notification.
 */
export async function dismissCheckIn(id: string): Promise<DismissCheckInResponse> {
  const { data } = await api.post<DismissCheckInResponse>(
    `/client/weekly-check-ins/${id}/dismiss`,
  )
  return data
}
