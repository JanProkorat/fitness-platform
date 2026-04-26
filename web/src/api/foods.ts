import api from '@/lib/api';
import type { UploadFoodImageUrlRequest, ConfirmFoodImageRequest } from './generated';
import type {
  SearchFoodsResponse,
  GetCustomFoodsResponse,
  FoodSummary,
  FoodCategory,
  CreateFoodRequest,
  UpdateFoodRequest,
} from './food-types';

/** Slot for food image upload: 'main' overwrites hero; 'gallery' appends (max 6). */
export type FoodImageSlot = 'main' | 'gallery';

/** Search foods by name with pagination. */
export async function searchFoods(params: {
  q?: string;
  category?: FoodCategory;
  page?: number;
  pageSize?: number;
}): Promise<SearchFoodsResponse> {
  const { data } = await api.get<SearchFoodsResponse>('/foods/search', { params });
  return data;
}

/** Get a single food by ID. */
export async function getFood(foodId: string): Promise<FoodSummary> {
  const { data } = await api.get<FoodSummary>(`/foods/${foodId}`);
  return data;
}

/** Create a custom food (Nutritionist only). */
export async function createFood(request: CreateFoodRequest): Promise<FoodSummary> {
  const { data } = await api.post<FoodSummary>('/foods', request);
  return data;
}

/** Update a custom food (Nutritionist only). */
export async function updateFood(foodId: string, request: UpdateFoodRequest): Promise<FoodSummary> {
  const { data } = await api.put<FoodSummary>(`/foods/${foodId}`, request);
  return data;
}

/** Delete a custom food (soft delete, Nutritionist only). */
export async function deleteFood(foodId: string): Promise<void> {
  await api.delete(`/foods/${foodId}`);
}

/** Get custom foods for the authenticated nutritionist. */
export async function getCustomFoods(params: {
  page?: number;
  pageSize?: number;
}): Promise<GetCustomFoodsResponse> {
  const { data } = await api.get<GetCustomFoodsResponse>('/foods/custom', { params });
  return data;
}

/**
 * Request a pre-signed upload URL for a food item image (Nutritionist only).
 * slot=main overwrites the hero image; slot=gallery appends to the gallery (max 6).
 */
export async function requestFoodImageUploadUrl(
  foodId: string,
  slot: FoodImageSlot,
  request: UploadFoodImageUrlRequest,
): Promise<{ uploadUrl: string; blobUrl: string }> {
  const { data } = await api.post<{ uploadUrl: string; blobUrl: string }>(
    `/foods/${foodId}/image/upload-url`,
    request,
    { params: { slot } },
  );
  return data;
}

/**
 * Confirm a completed food image upload by persisting its blob URL (Nutritionist only).
 * slot=main sets the main imageUrl; slot=gallery appends to galleryImageUrls.
 */
export async function confirmFoodImage(
  foodId: string,
  slot: FoodImageSlot,
  blobUrl: string,
): Promise<void> {
  const body: ConfirmFoodImageRequest = { blobUrl };
  await api.put(`/foods/${foodId}/image`, body, { params: { slot } });
}
