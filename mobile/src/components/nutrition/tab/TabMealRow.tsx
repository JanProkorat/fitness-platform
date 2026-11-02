import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MealFood } from '@/api/generated';
import type { NutritionMeal } from '@/api/nutrition';
import { MealRow } from '@/components/nutrition/meals/MealRow';
import type { MealRowPhoto } from '@/components/nutrition/meals/MealRow';
import type { MealStatus } from '@/components/nutrition/meals/MealStatusIcon';
import { useMealEaten } from '@/hooks/useMealEaten';
import { useMealItemEaten } from '@/hooks/useMealItemEaten';
import { usePendingKeys } from '@/stores/outbox';

type TabMealRowProps = {
  meal: NutritionMeal;
  status: MealStatus;
  first: boolean;
  photos: MealRowPhoto[];
  /** True for today once the log is loaded: the status icon then logs and unlogs the meal. */
  canLog: boolean;
  /** Ids of the items already ticked as eaten. */
  eatenItemIds?: readonly string[];
  onOpenRecipe: (recipeId: string, servings: number, meal?: NutritionMeal, itemId?: string) => void;
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

/** A meal row of the Nutrition tab: the shared row plus the checks that mark the meal or one item eaten. */
export function TabMealRow({
  meal,
  status,
  first,
  photos,
  canLog,
  eatenItemIds,
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
  const itemEaten = useMealItemEaten(meal);
  const pendingKeys = usePendingKeys();
  const pending = pendingKeys.mealEaten.has(meal.mealId) || pendingKeys.mealUnlogged.has(meal.mealId);
  const pendingItemIds = new Set<string>();
  // Ids are GUIDs, so the ':' of a pending item key only ever separates the meal from the item.
  for (const key of [...pendingKeys.mealItemEaten, ...pendingKeys.mealItemUnlogged]) {
    const [mealId, itemId] = key.split(':');
    if (mealId === meal.mealId && itemId) pendingItemIds.add(itemId);
  }

  const toggle = () => {
    eaten.mutate(status !== 'eaten', {
      onError: () => Alert.alert(t('nutritionTab.errors.toggleTitle'), t('nutritionMeal.errors.toggle')),
    });
  };

  const toggleItem = (itemId: string, next: boolean) => {
    itemEaten.mutate(
      { itemId, eaten: next },
      { onError: () => Alert.alert(t('nutritionTab.errors.toggleTitle'), t('nutritionMeal.errors.toggle')) },
    );
  };

  const busy = eaten.isPending || itemEaten.isPending;

  return (
    <MealRow
      meal={meal}
      first={first}
      status={status}
      pending={pending}
      photos={photos}
      eatenItemIds={eatenItemIds}
      pendingItemIds={pendingItemIds}
      onOpenRecipe={(recipeId, servings, itemId) => onOpenRecipe(recipeId, servings, meal, itemId)}
      onOpenFood={(food) => onOpenFood(food, meal)}
      onToggleEaten={canLog && !busy ? toggle : undefined}
      onToggleItem={canLog && !busy ? toggleItem : undefined}
      onAddPhoto={onAddPhoto}
      addPhotoBusy={addPhotoBusy}
      onOpenPhoto={onOpenPhoto}
      defaultExpanded={defaultExpanded}
      hideEatenState={hideEatenState}
    />
  );
}
