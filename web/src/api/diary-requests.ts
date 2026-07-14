/**
 * Diary requests API module.
 *
 * Wraps the NSwag-generated diary-request endpoints.
 */
import api from '@/lib/api';
import { apiClient } from '@/api/client';
import type {
  CreateRequestResponse,
  PhotoDiaryRequestSummary,
  PhotoDiaryStatus,
  PhotoDiaryMode,
} from '@/api/generated';

export type {
  CreateRequestResponse,
  PhotoDiaryRequestSummary,
  PhotoDiaryStatus,
  PhotoDiaryMode,
};

export interface CreateDiaryRequestParams {
  /** Internal integer ID of the client-professional link. XOR with pendingInviteId. */
  linkId?: number;
  /** Internal integer ID of the pending invite. XOR with linkId. */
  pendingInviteId?: number;
  /** Optional plan scope (MongoDB external ID). */
  planId?: string;
  /** Duration in days (1–30). Defaults to 7. */
  durationDays?: number;
}

/**
 * Create a photo diary request via POST /trainer/photo-diary-requests.
 */
export async function createDiaryRequest(
  params: CreateDiaryRequestParams,
): Promise<CreateRequestResponse> {
  return apiClient.createRequestEndpoint({
    linkId: params.linkId ?? undefined,
    pendingInviteId: params.pendingInviteId ?? undefined,
    planId: params.planId ?? undefined,
    durationDays: params.durationDays ?? 7,
  });
}

export interface ListDiaryRequestsParams {
  page?: number;
  pageSize?: number;
  status?: PhotoDiaryStatus | null;
  linkId?: number | null;
  planId?: string | null;
}

/**
 * List trainer's photo diary requests via GET /trainer/photo-diary-requests.
 * Supports filtering by status, linkId, and planId.
 */
export async function listDiaryRequests(
  params: ListDiaryRequestsParams = {},
): Promise<PhotoDiaryRequestSummary[]> {
  const response = await apiClient.listTrainerRequestsEndpoint(
    params.page ?? 1,
    params.pageSize ?? 50,
    params.status ?? undefined,
    params.linkId ?? undefined,
    undefined, // pendingInviteId
    params.planId ?? undefined,
  );
  return response.items ?? [];
}

/**
 * Response shape for POST /trainer/photo-diary-requests/{requestId}/link
 * (#778 AC5). Hand-written — this endpoint landed after the last
 * `generated.ts` regen, so it's wrapped as a raw axios call here rather
 * than editing the write-locked generated client for a single new route.
 * Mirrors `LinkPlanResponse` on the backend
 * (backend/.../PhotoDiaryRequests/LinkPlan/LinkPlanResponse.cs).
 */
export interface LinkPlanResponse {
  id: string;
  professionalId: string;
  linkId?: number | null;
  pendingInviteId?: number | null;
  planId?: string | null;
  durationDays: number;
  status: PhotoDiaryStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Retroactively links an existing photo diary request to a nutrition or
 * training plan via POST /trainer/photo-diary-requests/{requestId}/link.
 *
 * Diary-level (whole-diary) granularity — mirrors #777's response-level
 * questionnaire linking. Error paths: 404 (request not found / plan not
 * owned by the diary's client), 403 (caller isn't the owning
 * professional), 400 (missing/malformed planId) — surfaced by the caller
 * via `showApiError`.
 */
export async function linkPhotoDiaryToPlan(
  requestId: string,
  planId: string,
): Promise<LinkPlanResponse> {
  const { data } = await api.post<LinkPlanResponse>(
    `/trainer/photo-diary-requests/${requestId}/link`,
    { planId },
  );
  return data;
}
