import api from '@/lib/api';
import type {
  SearchFoodsResponse,
  GetCustomFoodsResponse,
  FoodSummary,
  FoodCategory,
  CreateFoodRequest,
  UpdateFoodRequest,
} from './food-types';

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
