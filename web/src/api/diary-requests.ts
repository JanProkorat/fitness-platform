/**
 * Diary requests API module.
 *
 * Wraps the NSwag-generated createRequestEndpoint.
 *
 * NOTE — backend contract gap:
 *   CreateRequestRequest requires `linkId` (int64) or `pendingInviteId` (int64).
 *   Neither is exposed in any client-list or invite-list response today.
 *   - GetClientDashboardResponse does not include linkId.
 *   - CreatePendingInviteResponse only contains publicId (GUID), not the internal integer.
 *   Callers must supply the integer ID when available; otherwise pass undefined and the
 *   dialog will disable submission (linkId-based flow) or skip the diary POST
 *   (invite-bundled flow). Both IDs need to be surfaced by the backend in a follow-up.
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
