import api from './client';
import { PlanPhotoCategory } from './generated';
import type { PlanPhotoResponse, FinalizePlanPhotoRequest } from './generated';

// Re-export generated types so consumer imports (`from '@/api/planPhotos'`) work.
export { PlanPhotoCategory };
export type { PlanPhotoResponse };

// ─── Response shapes ────────────────────────────────────────────────────────

export interface GeneratePlanPhotoUploadUrlResponse {
  uploadUrl: string;
  blobUrl: string;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Request a signed PUT URL for uploading a plan photo to blob storage.
 * Call this first, PUT the binary to uploadUrl, then call finalizePlanPhoto.
 */
export async function generatePlanPhotoUploadUrl(
  planId: string,
  contentType: string,
  sizeBytes: number,
): Promise<GeneratePlanPhotoUploadUrlResponse> {
  const { data } = await api.post<GeneratePlanPhotoUploadUrlResponse>(
    `/client/plans/${planId}/photos/upload-url`,
    { contentType, sizeBytes },
  );
  return data;
}

/**
 * Insert a PlanPhoto record after the blob has been uploaded.
 * One call per photo; the caller fires these in parallel after multi-select.
 */
export async function finalizePlanPhoto(
  planId: string,
  req: FinalizePlanPhotoRequest,
): Promise<PlanPhotoResponse> {
  const { data } = await api.post<PlanPhotoResponse>(
    `/client/plans/${planId}/photos`,
    req,
  );
  return data;
}

/**
 * List photos for a plan with optional category filtering and pagination.
 * Returns an empty array when the plan has no photos.
 */
export async function getPlanPhotos(
  planId: string,
  page: number,
  pageSize: number,
  category?: PlanPhotoCategory | null,
): Promise<PlanPhotoResponse[]> {
  const params: Record<string, string | number> = { page, pageSize };
  if (category != null) {
    params.category = category;
  }
  const { data } = await api.get<PlanPhotoResponse[]>(
    `/client/plans/${planId}/photos`,
    { params },
  );
  return data;
}

/**
 * Delete a plan photo by its public identifier.
 */
export async function deletePlanPhoto(photoId: string): Promise<void> {
  await api.delete(`/client/plans/photos/${photoId}`);
}
