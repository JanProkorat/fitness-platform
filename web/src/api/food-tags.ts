/**
 * Food-tags API module (#1120).
 *
 * Wraps the NSwag-generated FoodTags slice endpoints — coach-private tags a
 * nutritionist can assign to any visible food (system, shared, own).
 */
import { apiClient } from '@/api/client';
import type {
  FoodTagDto,
  CreateFoodTagRequest,
  UpdateFoodTagRequest,
  ReplaceFoodTagAssignmentsResponse,
} from '@/api/generated';

export type { FoodTagDto, CreateFoodTagRequest, UpdateFoodTagRequest, ReplaceFoodTagAssignmentsResponse };

/** Lists the caller's food tags via GET /trainer/food-tags. */
export async function getFoodTags(): Promise<FoodTagDto[]> {
  const response = await apiClient.getFoodTagsEndpoint();
  return response.tags ?? [];
}

/**
 * Creates a food tag owned by the caller via POST /trainer/food-tags.
 *
 * Can fail with FOOD_TAG_NAME_ALREADY_EXISTS (409) — the caller shows that
 * translated via the shared api-errors helper.
 */
export async function createFoodTag(request: CreateFoodTagRequest): Promise<FoodTagDto> {
  return apiClient.createFoodTagEndpoint(request);
}

/** Updates a food tag's name/description/color via PUT /trainer/food-tags/{tagId}. */
export async function updateFoodTag(tagId: string, request: UpdateFoodTagRequest): Promise<FoodTagDto> {
  return apiClient.updateFoodTagEndpoint(tagId, request);
}

/** Deletes a food tag via DELETE /trainer/food-tags/{tagId}. */
export async function deleteFoodTag(tagId: string): Promise<void> {
  await apiClient.deleteFoodTagEndpoint(tagId);
}

/**
 * Replaces the full set of the caller's own tags assigned to one food, via
 * PUT /trainer/foods/{foodId}/tags. The food may be the caller's own, a
 * system food, or another coach's Public food — tagging is the tagging
 * coach's own private relationship metadata, never a claim on the food.
 */
export async function replaceFoodTagAssignments(
  foodId: string,
  tagIds: string[],
): Promise<ReplaceFoodTagAssignmentsResponse> {
  return apiClient.replaceFoodTagAssignmentsEndpoint(foodId, { tagIds });
}
