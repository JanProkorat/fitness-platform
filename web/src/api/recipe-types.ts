/** Summary for recipe list views. */
export interface RecipeSummary {
  recipeId: string;
  name: string;
  foodCount: number;
  totalNutrients: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  dateCreated: string;
}

/** Full recipe detail. */
export interface RecipeDetail {
  recipeId: string;
  name: string;
  description: string;
  foods: {
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
  }[];
  totalNutrients: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  dateCreated: string;
  dateUpdated?: string | null;
}

/** Paginated recipe search response. */
export interface SearchRecipesResponse {
  recipes: RecipeSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Food item in create/update recipe request. */
export interface RecipeFoodInput {
  foodExternalId: string;
  amountGrams: number;
}

/** Request to create a recipe. */
export interface CreateRecipeRequest {
  name: string;
  description: string;
  foods: RecipeFoodInput[];
}

/** Request to update a recipe. */
export interface UpdateRecipeRequest {
  name: string;
  description: string;
  foods: RecipeFoodInput[];
}
