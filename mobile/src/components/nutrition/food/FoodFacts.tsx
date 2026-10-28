import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FoodSummary } from '@/api/generated';
import { Chip } from '@/components/Chip';
import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { formatWhole } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { servingUnitLabel } from '@/components/nutrition/food/servingUnit';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FoodFactsProps = { food: FoodSummary };

/** Diets the food suits, its allergens and its usual serving. */
export function FoodFacts({ food }: FoodFactsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const diets = food.dietaryPreferences ?? [];
  const allergens = food.allergens ?? [];
  const [serving] = food.commonServings ?? [];
  const servingGrams = serving?.weightGrams;

  return (
    <DetailCard>
      <View style={styles.content}>
        {diets.length > 0 ? (
          <View style={styles.block}>
            <Text variant="body" color="muted">
              {t('nutritionFood.suits')}
            </Text>
            <View style={styles.chips}>
              {diets.map((diet) => (
                <Chip key={diet} variant="nutrition" label={t(`nutritionFood.diets.${diet}`)} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.block}>
          <Text variant="body" color="muted">
            {t('nutritionFood.allergens')}
          </Text>
          <Text variant="bodyLarge">
            {allergens.length > 0
              ? allergens.map((allergen) => t(`nutritionFood.allergenNames.${allergen}`)).join(', ')
              : t('nutritionFood.noAllergens')}
          </Text>
        </View>
        {servingGrams ? (
          <View style={styles.block}>
            <Text variant="body" color="muted">
              {t('nutritionFood.serving')}
            </Text>
            <Text variant="bodyLarge">
              {t('nutritionFood.servingValue', {
                label: serving?.label
                  ? servingUnitLabel(t, serving.label)
                  : t('nutritionFood.portion'),
                value: formatWhole(i18n.language, servingGrams),
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </DetailCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
    block: {
      gap: theme.spacing.xs,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
  });
