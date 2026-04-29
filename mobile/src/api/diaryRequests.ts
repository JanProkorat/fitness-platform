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
  ListClientRequestsResponse,
  SubmitRequestResponse,
} from './generated'
import { PhotoDiaryMode, PhotoDiaryStatus } from './generated'

// Re-export so consumers only need one import.
export { PhotoDiaryMode, PhotoDiaryStatus }
export type { ClientPhotoDiaryRequestSummary, ListClientRequestsResponse, SubmitRequestResponse }

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
 * Fetch a single photo-diary request by ID.
 *
 * The backend does not expose a dedicated GET-by-id endpoint; we fetch the
 * full list filtered to the specific request's status and then find the one
 * we care about. In practice the list for a single client is small (< 20).
 *
 * `GET /client/photo-diary-requests`
 */
export async function getDiaryRequestById(
  requestId: string,
): Promise<ClientPhotoDiaryRequestSummary | undefined> {
  const { data } = await api.get<ListClientRequestsResponse>(
    '/client/photo-diary-requests',
    { params: { page: 1, pageSize: 50 } },
  )
  return (data.items ?? []).find((r) => r.id === requestId)
}

/**
 * Fetch active workflow diary requests for the client.
 * "Active" means Mode === Workflow AND Status ∈ {Accepted, InProgress}.
 *
 * `GET /client/photo-diary-requests`
 */
export async function getActiveWorkflowDiaryRequests(): Promise<ClientPhotoDiaryRequestSummary[]> {
  const { data } = await api.get<ListClientRequestsResponse>(
    '/client/photo-diary-requests',
    { params: { page: 1, pageSize: 50 } },
  )
  return (data.items ?? []).filter(
    (r) =>
      r.mode === PhotoDiaryMode.Workflow &&
      (r.status === PhotoDiaryStatus.Accepted || r.status === PhotoDiaryStatus.InProgress),
  )
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
