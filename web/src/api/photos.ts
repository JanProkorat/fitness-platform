import { apiClient } from '@/api/client';
import type { PlanPhotoCategory, PlanPhotoResponse } from '@/api/generated';

export type { PlanPhotoCategory, PlanPhotoResponse };

/** Fetch paginated list of photos for a plan, optionally filtered by category. */
export async function getPlanPhotos(
  planId: string,
  page: number,
  pageSize: number,
  category?: PlanPhotoCategory | null,
): Promise<PlanPhotoResponse[]> {
  return apiClient.getPlanPhotosEndpoint(planId, page, pageSize, category);
}

