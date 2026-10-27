import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MealFood } from '@/api/generated';
import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { foodMacros, foodName, formatAmount, formatWhole } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeIngredientsProps = {
  foods: MealFood[];
  /** Portions the amounts are scaled to; the recipe's own amounts are for `baseServings`. */
  portions: number;
  baseServings: number;
};

/** Ingredients with the amount and energy for the chosen number of portions. */
export function RecipeIngredients({ foods, portions, baseServings }: RecipeIngredientsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;

  return (
    <DetailCard>
      <View style={styles.header}>
        <Text variant="subtitle" accessibilityRole="header">
          {t('nutritionRecipe.ingredients.title')}
        </Text>
        <Text variant="caption" color="muted">
          {t('nutritionRecipe.ingredients.forPortions', { value: formatAmount(language, portions) })}
        </Text>
      </View>
      {foods.map((food, index) => {
        const grams = ((food.amountGrams ?? 0) / baseServings) * portions;
        return (
          <View
            key={`${food.foodExternalId ?? ''}-${index}`}
            style={index > 0 ? [styles.row, styles.divider] : styles.row}
          >
            <View style={styles.copy}>
              <Text variant="body" numberOfLines={2}>
                {foodName(food, language)}
              </Text>
              <Text variant="caption" color="muted">
                {t('nutritionRecipe.ingredients.kcal', { value: formatWhole(language, foodMacros(food, grams).kcal) })}
              </Text>
            </View>
            <Text variant="bodyStrong">
              {t('nutritionRecipe.ingredients.grams', { value: formatWhole(language, grams) })}
            </Text>
          </View>
        );
      })}
    </DetailCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
