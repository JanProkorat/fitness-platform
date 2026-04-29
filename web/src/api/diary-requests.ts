/**
 * Diary requests API module.
 *
 * Wraps the NSwag-generated createRequestEndpoint.
 */
import { apiClient } from '@/api/client';
import type { CreateRequestResponse } from '@/api/generated';

export type { CreateRequestResponse };

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
