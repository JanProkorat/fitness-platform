import api from './client';
import type {
  FoodSummary,
  NutrientValueDto,
  ServingSizeDto,
  SearchFoodsResponse,
} from './generated';

// Re-export generated types so consumer imports (`from '@/api/foods'`) still work.
export type { FoodSummary, NutrientValueDto, ServingSizeDto, SearchFoodsResponse };

/**
 * @deprecated Use `NutrientValueDto` from `./generated` instead.
 * Kept as alias for backward compatibility.
 */
export type FoodNutrientValue = NutrientValueDto;

/**
 * @deprecated Use `ServingSizeDto` from `./generated` instead.
 * Kept as alias for backward compatibility.
 */
export type ServingSize = ServingSizeDto;

// --- API calls ---

export async function getFoodById(foodId: string): Promise<FoodSummary> {
  const { data } = await api.get<FoodSummary>(`/foods/${foodId}`);
  return data;
}

export async function searchFoods(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchFoodsResponse> {
  const { data } = await api.get<SearchFoodsResponse>('/foods/search', { params });
  return data;
}
