import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { foodSummaryName } from '@/api/foods';
import { getErrorStatus } from '@/api/errors';
import type { FoodSummary } from '@/api/generated';
import { isNutritionId } from '@/api/nutrition';
import { FoodFacts } from '@/components/nutrition/food/FoodFacts';
import { FoodMacros } from '@/components/nutrition/food/FoodMacros';
import { DetailLayout } from '@/components/nutrition/meal/DetailLayout';
import { DetailState } from '@/components/nutrition/meal/DetailState';
import { formatWhole, macrosOf, scaleMacros } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useFoodDetail } from '@/hooks/useFoodDetail';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const MAX_GRAMS = 10000;

const parseGrams = (value: string | undefined): number | undefined => {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_GRAMS ? parsed : undefined;
};

/** One food: what a meal or off-plan entry uses of it, its macros per 100 g, diets and allergens. */
export default function FoodDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ foodId?: string; grams?: string; meal?: string }>();
  const foodId = typeof params.foodId === 'string' ? params.foodId : '';
  const valid = isNutritionId(foodId);
  const query = useFoodDetail(foodId, valid);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/nutrition'));

  if (!valid || query.isPending || query.isError) {
    const notFound = !valid || (query.isError && getErrorStatus(query.error) === 404);
    const pending = valid && query.isPending;
    return (
      <DetailState
        kind={pending ? 'pending' : notFound ? 'notFound' : 'error'}
        title={notFound ? t('nutritionFood.notFound.title') : t('nutritionFood.error.title')}
        body={notFound ? t('nutritionFood.notFound.body') : t('nutritionFood.error.body')}
        onBack={goBack}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <FoodDetailContent
      food={query.data}
      grams={typeof params.grams === 'string' ? parseGrams(params.grams) : undefined}
      mealKind={typeof params.meal === 'string' ? params.meal : undefined}
      onBack={goBack}
    />
  );
}

type FoodDetailContentProps = { food: FoodSummary; grams?: number; mealKind?: string; onBack: () => void };

function FoodDetailContent({ food, grams, mealKind, onBack }: FoodDetailContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const per100 = macrosOf(food.nutrientValue);
  const used = grams === undefined ? undefined : scaleMacros(per100, grams / 100);
  const mealLabel = mealKind ? t(`nutritionMeal.kind.${mealKind}`, { defaultValue: '' }) : '';

  return (
    <DetailLayout
      heroHeight={theme.sizes.recipeHero}
      imageUri={food.imageUrl}
      backLabel={t('onboarding.back')}
      onBack={onBack}
    >
      <View style={styles.title}>
        <Text variant="profileName" accessibilityRole="header">
          {foodSummaryName(food, language)}
        </Text>
      </View>

      {used && grams !== undefined ? (
        <View style={styles.used}>
          <Text variant="labelStrong" color="nutritionInk" style={styles.usedLabel}>
            {mealLabel ? t('nutritionFood.inMeal', { meal: mealLabel }) : t('nutritionFood.eaten')}
          </Text>
          <Text variant="bodyStrong">
            {t('nutritionFood.usedAmount', {
              grams: formatWhole(language, grams),
              kcal: formatWhole(language, used.kcal),
            })}
          </Text>
        </View>
      ) : null}

      <FoodMacros per100={per100} />
      <FoodFacts food={food} />
    </DetailLayout>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      paddingHorizontal: theme.spacing.xxs,
    },
    used: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.nutritionSoft,
    },
    usedLabel: {
      flex: 1,
      minWidth: 0,
    },
  });
