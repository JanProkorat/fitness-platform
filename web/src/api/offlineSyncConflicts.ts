import { isAxiosError } from 'axios';
import api from '@/lib/api';
import type {
  GetClientOfflineSyncConflictsResponse,
  OfflineSyncConflictDto,
  ReviewAllClientOfflineSyncConflictsRequest,
  ReviewAllClientOfflineSyncConflictsResponse,
} from '@/api/generated';

/**
 * Fetches a page of a client's offline-sync conflicts (newest detected first).
 * A link without nutrition access (403) or without a live link (404) yields an empty list.
 */
export async function getClientOfflineSyncConflicts(
  clientId: string,
  page = 1,
  pageSize = 5,
  filter: { planId?: string; unreviewedOnly?: boolean } = {},
): Promise<OfflineSyncConflictDto[]> {
  try {
    const { data } = await api.get<GetClientOfflineSyncConflictsResponse>(
      `/trainer/clients/${clientId}/offline-sync-conflicts`,
      { params: { page, pageSize, planId: filter.planId, unreviewedOnly: filter.unreviewedOnly } },
    );
    return data.items ?? [];
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)) {
      return [];
    }
    throw error;
  }
}

/** Marks one conflict reviewed (204). */
export async function reviewOfflineSyncConflict(clientId: string, conflictId: string): Promise<void> {
  await api.post(`/trainer/clients/${clientId}/offline-sync-conflicts/${conflictId}/review`);
}

/** Marks every unreviewed conflict of a client's plan reviewed; resolves with how many were newly marked. */
export async function reviewAllOfflineSyncConflicts(clientId: string, planId: string): Promise<number> {
  const body: ReviewAllClientOfflineSyncConflictsRequest = { planId };
  const { data } = await api.post<ReviewAllClientOfflineSyncConflictsResponse>(
    `/trainer/clients/${clientId}/offline-sync-conflicts/review-all`,
    body,
  );
  return data.reviewedCount ?? 0;
}

/** Payload of the `offlinesyncconflict` notification, as serialised in `NotificationDto.actionPayload`. */
export interface OfflineSyncConflictNotificationPayload {
  clientName?: string;
  clientPublicId?: string;
}

/** Parses `actionPayload`; returns an empty object when it is missing or not valid JSON. */
export function parseOfflineSyncConflictPayload(raw: string | null | undefined): OfflineSyncConflictNotificationPayload {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    return {
      clientName: typeof record.clientName === 'string' ? record.clientName : undefined,
      clientPublicId: typeof record.clientPublicId === 'string' && record.clientPublicId ? record.clientPublicId : undefined,
    };
  } catch {
    return {};
  }
}
