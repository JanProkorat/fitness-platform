import { apiClient } from '@/api/client';
import { PlanPhotoCategory as PlanPhotoCategoryValue } from '@/api/generated';
import type { PlanPhotoCategory, PlanPhotoResponse, ClientPhotoResponse } from '@/api/generated';

export type { PlanPhotoCategory, PlanPhotoResponse, ClientPhotoResponse };

/**
 * Fetch paginated list of photos for a plan, scoped to a specific client.
 *
 * The web portal is trainer-only, so this hits the trainer endpoint
 * (`/trainer/clients/{clientId}/photos?planId=…`) which authorises via the
 * trainer-client link rather than self-ownership. The dedicated client
 * endpoint (`/client/plans/{planId}/photos`) cannot be used here because it
 * requires the `Client` role and would 403 a coach.
 */
export async function getPlanPhotos(
  clientId: string,
  planId: string,
  page: number,
  pageSize: number,
  category?: PlanPhotoCategory | null,
): Promise<ClientPhotoResponse[]> {
  const response = await apiClient.getTrainerClientPhotosEndpoint(
    clientId,
    page,
    pageSize,
    false, // groupByMonth — flat list
    category,
    undefined, // from
    undefined, // to
    planId,
  );
  return response.photos ?? [];
}

/** Food photos a client took between `from` and `to` (ISO UTC), newest first. */
export async function getClientFoodPhotos(
  clientId: string,
  from: string,
  to: string,
  pageSize: number,
): Promise<ClientPhotoResponse[]> {
  const response = await apiClient.getTrainerClientPhotosEndpoint(
    clientId,
    1,
    pageSize,
    false, // groupByMonth: flat list
    PlanPhotoCategoryValue.Food,
    from,
    to,
    undefined, // planId
  );
  return response.photos ?? [];
}

