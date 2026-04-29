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
  SubmitRequestResponse,
} from './generated'
import { PhotoDiaryMode } from './generated'

// Re-export so consumers only need one import.
export { PhotoDiaryMode }
export type { ClientPhotoDiaryRequestSummary, SubmitRequestResponse }

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

/**
 * Submit / finalize a photo-diary bulk request.
 *
 * `POST /client/photo-diary-requests/{id}/submit`
 *
 * Transitions the request from Accepted/InProgress → Completed and
 * notifies the trainer via the `photoDiarySubmitted` SignalR event.
 * Call this after all photos have been uploaded and finalized.
 */
export async function submitDiaryRequest(
  requestId: string,
): Promise<SubmitRequestResponse> {
  const { data } = await api.post<SubmitRequestResponse>(
    `/client/photo-diary-requests/${requestId}/submit`,
    {},
  )
  return data
}
