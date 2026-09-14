import { apiClient } from '@/api/client';
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

