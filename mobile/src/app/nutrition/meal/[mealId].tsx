import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isMealEaten, isNutritionId, findMealLog, mealPhotos, storedMealPhotos } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { PhotoUploadError } from '@/api/photos';
import type { PickedPhoto } from '@/api/photos';
import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { DetailLayout } from '@/components/nutrition/meal/DetailLayout';
import { DetailState } from '@/components/nutrition/meal/DetailState';
import { addMacros, EMPTY_MACROS, foodMacros, macrosOf, recipeMacros } from '@/components/nutrition/meal/format';
import { GlassIconButton } from '@/components/nutrition/meal/GlassIconButton';
import { MacroStrip } from '@/components/nutrition/meal/MacroStrip';
import { MealItems } from '@/components/nutrition/meal/MealItems';
import { pickMealPhoto } from '@/components/nutrition/meal/pickMealPhoto';
import type { PhotoSource } from '@/components/nutrition/meal/pickMealPhoto';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useMealDetail } from '@/hooks/useMealDetail';
import { useMealEaten } from '@/hooks/useMealEaten';
import { useMealPhotos } from '@/hooks/useMealPhotos';
import { useRecipeDetail } from '@/hooks/useRecipeDetail';
import { useTodayMealLog } from '@/hooks/useTodayMealLog';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PhotoFailure = 'tooLarge' | 'unsupportedType' | 'upload';

const photoFailure = (error: unknown): PhotoFailure => {
  const failure = error instanceof PhotoUploadError ? error.failure : 'upload';
  return failure === 'tooLarge' || failure === 'unsupportedType' ? failure : 'upload';
};

/** A planned meal: what is in it, its macros, and, for today's meals, eaten state and a photo. */
export default function MealDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ mealId?: string }>();
  const mealId = typeof params.mealId === 'string' ? params.mealId : '';
  const detail = useMealDetail(mealId, isNutritionId(mealId));
  const goBack = () => router.back();

  if (detail.status === 'ready') {
    return <MealDetailContent meal={detail.lookup.meal} isToday={detail.lookup.isToday} />;
  }
  return (
    <DetailState
      kind={detail.status}
      title={detail.status === 'error' ? t('nutritionMeal.error.title') : t('nutritionMeal.notFound.title')}
      body={detail.status === 'error' ? t('nutritionMeal.error.body') : t('nutritionMeal.notFound.body')}
      onBack={goBack}
      onRetry={detail.status === 'error' ? detail.retry : undefined}
    />
  );
}

function MealDetailContent({ meal, isToday }: { meal: NutritionMeal; isToday: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const logQuery = useTodayMealLog(isToday);
  const eaten = useMealEaten(meal);
  const photoUpload = useMealPhotos(meal.mealId);
  const [picking, setPicking] = useState(false);

  const entry = findMealLog(logQuery.data, meal.mealId);
  const isEaten = isMealEaten(entry);
  const photos = mealPhotos(entry);
  const latestPhoto = photos.length > 0 ? photos[photos.length - 1] : undefined;

  // With exactly one recipe and no photo of the client's own, the recipe image stands in for the meal.
  const onlyRecipeId = (meal.recipes ?? []).length === 1 ? meal.recipes?.[0]?.recipeId : undefined;
  const recipeQuery = useRecipeDetail(onlyRecipeId ?? '', onlyRecipeId !== undefined && latestPhoto === undefined);
  const imageUri = latestPhoto?.displayUrl ?? recipeQuery.data?.imageUrl;

  const totals = meal.mealTotals
    ? macrosOf(meal.mealTotals)
    : [
        ...(meal.foods ?? []).map((food) => foodMacros(food)),
        ...(meal.recipes ?? []).map((recipe) => recipeMacros(recipe)),
      ].reduce(addMacros, EMPTY_MACROS);

  const infoParts = [
    meal.time ?? null,
    isEaten && entry?.eatenAt
      ? t('nutritionMeal.eatenAt', {
          time: new Date(entry.eatenAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
        })
      : null,
  ].filter(Boolean);

  const toggleEaten = () => {
    eaten.mutate(!isEaten, { onError: () => Alert.alert(t('nutritionMeal.errors.toggle')) });
  };

  const upload = (photo: PickedPhoto) => {
    photoUpload.mutate(
      { photo, existing: storedMealPhotos(entry) },
      {
        onError: (error) =>
          Alert.alert(t('nutritionMeal.photo.errors.title'), t(`nutritionMeal.photo.errors.${photoFailure(error)}`)),
      },
    );
  };

  const addPhoto = async (source: PhotoSource) => {
    setPicking(true);
    try {
      const result = await pickMealPhoto(source);
      if (result.kind === 'denied') {
        Alert.alert(t('nutritionMeal.photo.permission.title'), t('nutritionMeal.photo.permission.body'), [
          { text: t('nutritionMeal.photo.cancel'), style: 'cancel' },
          { text: t('nutritionMeal.photo.permission.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
      } else if (result.kind === 'picked') {
        upload(result.photo);
      }
    } finally {
      setPicking(false);
    }
  };

  const askSource = () => {
    Alert.alert(t('nutritionMeal.photo.title'), undefined, [
      { text: t('nutritionMeal.photo.camera'), onPress: () => void addPhoto('camera') },
      { text: t('nutritionMeal.photo.library'), onPress: () => void addPhoto('library') },
      { text: t('nutritionMeal.photo.cancel'), style: 'cancel' },
    ]);
  };

  const logUnavailable = logQuery.isPending || logQuery.isError;

  return (
    <DetailLayout
      heroHeight={theme.sizes.mealHero}
      imageUri={imageUri}
      backLabel={t('onboarding.back')}
      onBack={() => router.back()}
      actions={
        isToday ? (
          <GlassIconButton
            symbol="camera"
            label={t('nutritionMeal.photo.add')}
            onPress={askSource}
            busy={picking || photoUpload.isPending || logQuery.isPending}
          />
        ) : undefined
      }
      footer={
        isToday ? (
          <Button
            label={isEaten ? t('nutritionMeal.unmarkEaten') : t('nutritionMeal.logMeal')}
            variant={isEaten ? 'ink' : 'nutrition'}
            disabled={logUnavailable || eaten.isPending}
            onPress={toggleEaten}
            style={styles.footerButton}
            icon={
              eaten.isPending ? (
                <ActivityIndicator color={isEaten ? theme.colors.onPrimary : theme.colors.onNutrition} />
              ) : (
                <SymbolView
                  name={isEaten ? 'arrow.uturn.backward' : 'checkmark'}
                  weight="semibold"
                  tintColor={isEaten ? theme.colors.onPrimary : theme.colors.onNutrition}
                  size={theme.sizes.fieldIcon}
                />
              )
            }
          />
        ) : undefined
      }
    >
      <View style={styles.title}>
        <Text variant="profileName" accessibilityRole="header">
          {meal.kind ? t(`nutritionMeal.kind.${meal.kind}`) : t('nutritionMeal.title')}
        </Text>
        {infoParts.length > 0 ? (
          <Text variant="body" color={isEaten ? 'nutritionInk' : 'muted'}>
            {infoParts.join(' · ')}
          </Text>
        ) : null}
      </View>

      <DetailCard>
        <MacroStrip macros={totals} />
      </DetailCard>

      <MealItems
        meal={meal}
        onOpenRecipe={(recipeId, servings) =>
          router.push({ pathname: '/nutrition/recipe/[recipeId]', params: { recipeId, servings: String(servings) } })
        }
      />

      {meal.note ? (
        <DetailCard>
          <Text variant="body">{meal.note}</Text>
        </DetailCard>
      ) : null}

      {!isToday ? (
        <Text variant="bodySmall" color="muted" style={styles.hint}>
          {t('nutritionMeal.notToday')}
        </Text>
      ) : null}
    </DetailLayout>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xxs,
    },
    hint: {
      textAlign: 'center',
    },
    footerButton: {
      flex: 1,
    },
  });
