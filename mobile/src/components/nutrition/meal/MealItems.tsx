import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { NutritionMeal } from '@/api/nutrition';
import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { foodMacros, foodName, formatAmount, formatWhole, recipeMacros } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type MealItemsProps = {
  meal: NutritionMeal;
  onOpenRecipe: (recipeId: string, servings: number) => void;
};

/** The foods and recipes of a meal, each with its amount and energy; recipes open their detail. */
export function MealItems({ meal, onOpenRecipe }: MealItemsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const foods = meal.foods ?? [];
  const recipes = meal.recipes ?? [];
  if (foods.length === 0 && recipes.length === 0) return null;

  const kcal = (value: number) => t('nutritionMeal.items.kcal', { value: formatWhole(language, value) });
  let rowIndex = 0;
  const rowStyle = () => (rowIndex++ > 0 ? [styles.row, styles.divider] : styles.row);

  return (
    <DetailCard>
      <View style={styles.header}>
        <Text variant="subtitle" accessibilityRole="header">
          {t('nutritionMeal.items.title')}
        </Text>
      </View>

      {recipes.map((recipe, index) => {
        const servings = recipe.servings ?? 1;
        const content = (
          <>
            <View style={styles.copy}>
              <Text variant="body" numberOfLines={2}>
                {recipe.recipeName}
              </Text>
              <Text variant="caption" color="muted">
                {kcal(recipeMacros(recipe).kcal)}
              </Text>
            </View>
            <Text variant="bodySmall" color="muted">
              {t('nutritionMeal.items.servings', { value: formatAmount(language, servings) })}
            </Text>
            {recipe.recipeId ? (
              <SymbolView
                name="chevron.right"
                weight="medium"
                tintColor={theme.colors.muted}
                size={theme.sizes.listChevron}
              />
            ) : null}
          </>
        );
        const recipeId = recipe.recipeId;
        if (!recipeId) {
          return (
            <View key={`recipe-${index}`} style={rowStyle()}>
              {content}
            </View>
          );
        }
        return (
          <Pressable
            key={`recipe-${recipeId}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t('nutritionMeal.items.openRecipe', { name: recipe.recipeName ?? '' })}
            onPress={() => onOpenRecipe(recipeId, servings)}
            style={rowStyle()}
          >
            {content}
          </Pressable>
        );
      })}

      {foods.map((food, index) => (
        <View key={`food-${food.foodExternalId ?? ''}-${index}`} style={rowStyle()}>
          <View style={styles.copy}>
            <Text variant="body" numberOfLines={2}>
              {foodName(food, language)}
            </Text>
            <Text variant="caption" color="muted">
              {kcal(foodMacros(food).kcal)}
            </Text>
          </View>
          <Text variant="bodySmall" color="muted">
            {t('nutritionMeal.items.grams', { value: formatWhole(language, food.amountGrams ?? 0) })}
          </Text>
        </View>
      ))}
    </DetailCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      paddingBottom: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
  });
