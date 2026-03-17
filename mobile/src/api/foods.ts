import api from './client';

// --- Types ---

export interface FoodNutrientValue {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  salt?: number | null;
}

export interface ServingSize {
  label: string;
  weightGrams: number;
}

export interface FoodSummary {
  foodId: string;
  name: string;
  source?: string | null;
  barcode?: string | null;
  nutrientValue: FoodNutrientValue;
  allergens: string[];
  commonServings: ServingSize[];
  isVerified: boolean;
}

export interface SearchFoodsResponse {
  foods: FoodSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- API calls ---

export async function getFoodByBarcode(barcode: string): Promise<FoodSummary> {
  const { data } = await api.get<FoodSummary>(`/foods/barcode/${barcode}`);
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
