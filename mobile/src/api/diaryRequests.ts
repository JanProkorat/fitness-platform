/**
 * Domain module for client photo-diary request actions.
 *
 * All endpoints under `/client/photo-diary-requests/`.
 * Types come from `generated.ts` — do not edit that file.
 */
import api from './client'
import type {
  AcceptRequestRequest,
  AcceptRequestResponse,
  ClientPhotoDiaryRequestSummary,
} from './generated'
import { PhotoDiaryMode } from './generated'

// Re-export so consumers only need one import.
export { PhotoDiaryMode }
export type { ClientPhotoDiaryRequestSummary }

/**
 * Accept a pending photo-diary request with the chosen upload mode.
 *
 * `POST /client/photo-diary-requests/{id}/accept`
 *
 * Transitions the request from Pending → Accepted and stores the mode.
 */
export async function acceptDiaryRequest(
  requestId: string,
  mode: PhotoDiaryMode,
): Promise<AcceptRequestResponse> {
  const body: AcceptRequestRequest = { mode }
  const { data } = await api.post<AcceptRequestResponse>(
    `/client/photo-diary-requests/${requestId}/accept`,
    body,
  )
  return data
}
