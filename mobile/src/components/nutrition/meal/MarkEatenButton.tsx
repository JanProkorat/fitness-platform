import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import {
  TODAY_PLAN_KEY,
  fetchTodayPlan,
  findMealLog,
  isItemEaten,
  isMealEaten,
  isNutritionId,
  mealItemIdsOf,
} from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { Button } from '@/components/Button';
import { useMealItemEaten } from '@/hooks/useMealItemEaten';
import { useTodayMealLog } from '@/hooks/useTodayMealLog';
import { useTheme } from '@/theme';

type MarkEatenButtonProps = { meal: NutritionMeal; itemId: string; eaten: boolean };

/** Marks the food or recipe on screen as eaten, or undoes it; the same write as the tick in the meal row. */
function MarkEatenButton({ meal, itemId, eaten }: MarkEatenButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const mutation = useMealItemEaten(meal);

  const press = () =>
    mutation.mutate(
      { itemId, eaten: !eaten },
      { onError: () => Alert.alert(t('nutritionTab.errors.toggleTitle'), t('nutritionMeal.errors.toggle')) },
    );

  return (
    <Button
      variant={eaten ? 'ink' : 'nutrition'}
      label={eaten ? t('nutritionMeal.markEaten.undo') : t('nutritionMeal.markEaten.mark')}
      disabled={mutation.isPending}
      onPress={press}
      icon={
        <SymbolView
          name="checkmark"
          weight="bold"
          tintColor={eaten ? theme.colors.onPrimary : theme.colors.onNutrition}
          size={theme.sizes.mealStatusGlyph}
        />
      }
    />
  );
}

/**
 * The "Mark as eaten" footer of a food or recipe screen, or undefined when there is nothing to mark. It shows only
 * when the screen was opened from a meal of today's plan (both ids given, the item is in that meal) and today's
 * log has loaded; the library, off-plan food and the week view pass no ids.
 */
export function useMarkEatenFooter(mealId: string | undefined, itemId: string | undefined): ReactNode {
  const requested = mealId !== undefined && itemId !== undefined && isNutritionId(mealId) && isNutritionId(itemId);
  const plan = useQuery({
    queryKey: TODAY_PLAN_KEY,
    queryFn: ({ signal }) => fetchTodayPlan(signal),
    retry: false,
    enabled: requested,
  });
  const log = useTodayMealLog(requested);

  if (!requested || !plan.data || !log.data) return undefined;
  const meal = (plan.data.meals ?? []).find(
    (candidate): candidate is NutritionMeal => candidate.mealId === mealId,
  );
  if (!meal || !mealItemIdsOf(meal).includes(itemId)) return undefined;

  const entry = findMealLog(log.data, meal.mealId);
  const eaten = isItemEaten(isMealEaten(entry), entry?.eatenItemIds ?? [], itemId);
  return <MarkEatenButton meal={meal} itemId={itemId} eaten={eaten} />;
}
