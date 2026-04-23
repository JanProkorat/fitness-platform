/** Food category enum. */
export type FoodCategory =
  | 'Other' | 'Fruit' | 'Vegetables' | 'Meat' | 'FishAndSeafood'
  | 'Dairy' | 'GrainsAndCereals' | 'Legumes' | 'NutsAndSeeds'
  | 'OilsAndFats' | 'SweetsAndSnacks' | 'Beverages' | 'Supplements';

/** Food visibility — Public is visible to all nutritionists, Private only to the owner. */
export type FoodVisibility = 'Public' | 'Private';

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
  nutrientValue: NutrientValueDto;
  category?: FoodCategory;
  note?: string | null;
  allergens: string[];
  commonServings: ServingSizeDto[];
  visibility?: FoodVisibility;
  isOwnedByCurrentUser?: boolean;
  /** URL of the food hero image in blob storage. Null when no image has been uploaded. */
  imageUrl?: string | null;
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
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  nutrientValue: NutrientValueDto;
  category?: FoodCategory;
  note?: string | null;
  allergens: string[];
  commonServings: ServingSizeDto[];
  visibility?: FoodVisibility;
}

/** Request to create a custom food. */
export interface CreateFoodRequest {
  name: string;
  nameEn?: string | null;
  nameCs?: string | null;
  nameDe?: string | null;
  nutrientValue: NutrientValueDto;
  category?: FoodCategory;
  note?: string | null;
  allergens: string[];
  commonServings: ServingSizeDto[];
  visibility?: FoodVisibility;
}
