/** Nutrient values per 100 grams. */
export interface NutrientValueDto {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  salt?: number | null;
}

/** Serving size option. */
export interface ServingSizeDto {
  label: string;
  weightGrams: number;
}

/** Food item summary returned by the API. */
export interface FoodSummary {
  foodId: string;
  name: string;
  rawName: string;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  source?: string | null;
  barcode?: string | null;
  nutrientValue: NutrientValueDto;
  allergens: string[];
  commonServings: ServingSizeDto[];
}

/** Paginated food search response. */
export interface SearchFoodsResponse {
  foods: FoodSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Paginated custom foods response. */
export interface GetCustomFoodsResponse {
  foods: FoodSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to update a custom food. */
export interface UpdateFoodRequest {
  name: string;
  barcode?: string | null;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  nutrientValue: NutrientValueDto;
  allergens: string[];
  commonServings: ServingSizeDto[];
}

/** Request to create a custom food. */
export interface CreateFoodRequest {
  name: string;
  barcode?: string | null;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  nutrientValue: NutrientValueDto;
  allergens: string[];
  commonServings: ServingSizeDto[];
}
