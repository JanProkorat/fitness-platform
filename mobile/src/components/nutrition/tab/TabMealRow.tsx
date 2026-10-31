import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MealFood } from '@/api/generated';
import type { NutritionMeal } from '@/api/nutrition';
import { MealRow } from '@/components/nutrition/meals/MealRow';
import type { MealRowPhoto } from '@/components/nutrition/meals/MealRow';
import type { MealStatus } from '@/components/nutrition/meals/MealStatusIcon';
import { useMealEaten } from '@/hooks/useMealEaten';
import { usePendingKeys } from '@/stores/outbox';

type TabMealRowProps = {
  meal: NutritionMeal;
  status: MealStatus;
  first: boolean;
  photos: MealRowPhoto[];
  /** True for today once the log is loaded: the status icon then logs and unlogs the meal. */
  canLog: boolean;
  onOpenRecipe: (recipeId: string, servings: number) => void;
  onOpenFood: (food: MealFood, meal: NutritionMeal) => void;
  /** Present on today only. */
  onAddPhoto?: () => void;
  addPhotoBusy: boolean;
  onOpenPhoto: (index: number) => void;
  /** Initial state only: the row starts expanded. */
  defaultExpanded?: boolean;
  /** Future day: no eaten tick and no add-photo. */
  hideEatenState?: boolean;
};

/** A meal row of the Nutrition tab: the shared row plus the check that marks the meal eaten. */
export function TabMealRow({
  meal,
  status,
  first,
  photos,
  canLog,
  onOpenRecipe,
  onOpenFood,
  onAddPhoto,
  addPhotoBusy,
  onOpenPhoto,
  defaultExpanded = false,
  hideEatenState = false,
}: TabMealRowProps) {
  const { t } = useTranslation();
  const eaten = useMealEaten(meal);
  const pendingKeys = usePendingKeys();
  const pending = pendingKeys.mealEaten.has(meal.mealId) || pendingKeys.mealUnlogged.has(meal.mealId);

  const toggle = () => {
    eaten.mutate(status !== 'eaten', {
      onError: () => Alert.alert(t('nutritionTab.errors.toggleTitle'), t('nutritionMeal.errors.toggle')),
    });
  };

  return (
    <MealRow
      meal={meal}
      first={first}
      status={status}
      pending={pending}
      photos={photos}
      onOpenRecipe={onOpenRecipe}
      onOpenFood={(food) => onOpenFood(food, meal)}
      onToggleEaten={canLog && !eaten.isPending ? toggle : undefined}
      onAddPhoto={onAddPhoto}
      addPhotoBusy={addPhotoBusy}
      onOpenPhoto={onOpenPhoto}
      defaultExpanded={defaultExpanded}
      hideEatenState={hideEatenState}
    />
  );
}
