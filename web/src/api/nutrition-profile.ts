import api from '@/lib/api';
import type { UpdateClientNutritionProfileRequest, UpdateClientNutritionProfileResponse } from '@/api/generated';

export type { UpdateClientNutritionProfileRequest, UpdateClientNutritionProfileResponse };

/**
 * Edit a client's nutrition profile (dislikes, habits, allergies, fibre target).
 * Route: PUT /trainer/clients/{clientId}/nutrition-profile, where clientId is the client's public id.
 */
export async function updateClientNutritionProfile(
  clientId: string,
  body: UpdateClientNutritionProfileRequest,
): Promise<UpdateClientNutritionProfileResponse> {
  const { data } = await api.put<UpdateClientNutritionProfileResponse>(
    `/trainer/clients/${clientId}/nutrition-profile`,
    body,
  );
  return data;
}
