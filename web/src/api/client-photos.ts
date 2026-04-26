import { apiClient } from '@/api/client';
import type {
  GetTrainerClientPhotosResponse,
  MonthGroupResponse,
  PlanPhotoResponse2,
  PlanPhotoCategory,
} from '@/api/generated';

export type { GetTrainerClientPhotosResponse, MonthGroupResponse, PlanPhotoResponse2, PlanPhotoCategory };

export interface GetClientPhotosParams {
  clientId: string;
  page?: number;
  pageSize?: number;
  category?: PlanPhotoCategory | null;
  from?: string | null;
  to?: string | null;
}

/**
 * Fetch a client's progress photos, grouped by calendar month.
 * Always passes groupByMonth=true; pagination applies to month groups.
 */
export async function getClientPhotoGroups(
  params: GetClientPhotosParams,
): Promise<GetTrainerClientPhotosResponse> {
  return apiClient.getTrainerClientPhotosEndpoint(
    params.clientId,
    params.page ?? 1,
    params.pageSize ?? 50,
    true,
    params.category ?? undefined,
    params.from ?? undefined,
    params.to ?? undefined,
  );
}
