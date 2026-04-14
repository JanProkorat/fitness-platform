import type { RecipeDetail } from '@/api/recipe-types';
import type { MealFood } from '@/api/plan-types';

export interface StagedRecipe {
  recipe: RecipeDetail;
  portions: number;
}

export interface AddItemsDrawerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (items: MealFood[]) => void;
}
