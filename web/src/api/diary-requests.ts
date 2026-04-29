/**
 * Diary requests API module.
 *
 * Wraps the NSwag-generated diary-request endpoints.
 */
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
