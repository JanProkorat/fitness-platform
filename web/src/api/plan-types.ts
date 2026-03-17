/** Macronutrient totals for a meal or day. */
export interface NutrientTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Global nutrition targets for the plan. */
export interface GlobalNutritionSettings {
  dailyKcal?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
}

/** A single food item within a meal. */
export interface MealFood {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    saturatedFat?: number | null;
    salt?: number | null;
  };
  amountGrams: number;
}

/** A meal within a plan day. */
export interface PlanMeal {
  mealId: string;
  name: string;
  order: number;
  time?: string | null;
  foods: MealFood[];
  mealTotals?: NutrientTotals | null;
}

/** A single day within a plan week. */
export interface PlanDay {
  dayOfWeek: number; // 1=Mon, 7=Sun
  meals: PlanMeal[];
  dayTotals?: NutrientTotals | null;
}

/** A week within the nutrition plan. */
export interface PlanWeek {
  weekNumber: number;
  days: PlanDay[];
}

/** Full nutrition plan detail returned by the API. */
export interface NutritionPlanDetail {
  planId: string;
  clientId: string;
  nutritionistId: string;
  name: string;
  status: 'Draft' | 'Active' | 'Archived';
  globalSettings?: GlobalNutritionSettings | null;
  weeks: PlanWeek[];
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
  datePublished?: string | null;
}

/** Plan summary for list views. */
export interface PlanSummary {
  planId: string;
  name: string;
  clientId: string;
  status: 'Draft' | 'Active' | 'Archived';
  weekCount: number;
  version: number;
  dateCreated: string;
  dateUpdated?: string | null;
}

/** Paginated plan list response. */
export interface GetPlansResponse {
  plans: PlanSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Request to create a new nutrition plan. */
export interface CreatePlanRequest {
  clientId: string;
  name: string;
  globalSettings?: GlobalNutritionSettings | null;
  weekCount?: number;
}

/** Request to update an existing plan (includes version for optimistic locking). */
export interface UpdatePlanRequest {
  name: string;
  globalSettings?: GlobalNutritionSettings | null;
  version: number;
}

/** Request to add a meal to a day. */
export interface AddMealRequest {
  name: string;
  order: number;
  time?: string | null;
}

/** Request to add a food to a meal. */
export interface AddFoodToMealRequest {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    saturatedFat?: number | null;
    salt?: number | null;
  };
  amountGrams: number;
}
