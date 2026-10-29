import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { GetTodayLogResponse } from '@/api/generated';
import {
  MEAL_LOG_DATE_IN_FUTURE,
  findMealLog,
  getTopLevelErrorCode,
  storedMealPhotos,
} from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { PhotoUploadError } from '@/api/photos';
import type { PickedPhoto } from '@/api/photos';
import { pickMealPhoto } from '@/components/nutrition/meal/pickMealPhoto';
import type { PhotoSource } from '@/components/nutrition/meal/pickMealPhoto';
import { useAddDayMealPhoto } from '@/hooks/useAddDayMealPhoto';
import { useRemoveOffPlanFood } from '@/hooks/useOffPlanFood';

type PhotoFailure = 'tooLarge' | 'unsupportedType' | 'upload' | 'future';

const photoFailure = (error: unknown): PhotoFailure => {
  if (getTopLevelErrorCode(error) === MEAL_LOG_DATE_IN_FUTURE) return 'future';
  const failure = error instanceof PhotoUploadError ? error.failure : 'upload';
  return failure === 'tooLarge' || failure === 'unsupportedType' ? failure : 'upload';
};

/**
 * Today's meal actions shared by the Nutrition tab and Today: photo pick and upload, the photo viewer,
 * the off-plan sheet, and opening or removing food.
 */
export function useTodayMealActions(todayLog: GetTodayLogResponse | undefined, today: string) {
  const { t } = useTranslation();
  const router = useRouter();

  const photoUpload = useAddDayMealPhoto();
  const removeOffPlan = useRemoveOffPlanFood();
  const [picking, setPicking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewer, setViewer] = useState<{ mealId: string; index: number } | null>(null);

  const upload = (meal: NutritionMeal, photo: PickedPhoto) => {
    photoUpload.mutate(
      {
        mealId: meal.mealId,
        date: today,
        photo,
        existing: storedMealPhotos(findMealLog(todayLog, meal.mealId)),
      },
      {
        onError: (error) =>
          Alert.alert(t('nutritionPlan.photo.errors.title'), t(`nutritionPlan.photo.errors.${photoFailure(error)}`)),
      },
    );
  };

  const addPhoto = async (meal: NutritionMeal, source: PhotoSource) => {
    setPicking(true);
    try {
      const result = await pickMealPhoto(source);
      if (result.kind === 'denied') {
        Alert.alert(t('nutritionPlan.photo.permission.title'), t('nutritionPlan.photo.permission.body'), [
          { text: t('nutritionPlan.photo.cancel'), style: 'cancel' },
          { text: t('nutritionPlan.photo.permission.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
      } else if (result.kind === 'picked') {
        upload(meal, result.photo);
      }
    } finally {
      setPicking(false);
    }
  };

  const askSource = (meal: NutritionMeal) => {
    Alert.alert(t('nutritionPlan.photo.title'), undefined, [
      { text: t('nutritionPlan.photo.camera'), onPress: () => void addPhoto(meal, 'camera') },
      { text: t('nutritionPlan.photo.library'), onPress: () => void addPhoto(meal, 'library') },
      { text: t('nutritionPlan.photo.cancel'), style: 'cancel' },
    ]);
  };

  const openFood = (foodId: string | undefined, grams?: number, kind?: string) => {
    if (!foodId) return;
    router.push({
      pathname: '/nutrition/food/[foodId]',
      params: {
        foodId,
        ...(grams !== undefined ? { grams: String(grams) } : {}),
        ...(kind ? { meal: kind } : {}),
      },
    });
  };

  const removeEntry = (entryId: string) => {
    removeOffPlan.mutate(entryId, {
      onError: () => Alert.alert(t('nutritionTab.errors.removeOffPlan')),
    });
  };

  const openRecipe = (recipeId: string, servings: number) =>
    router.push({
      pathname: '/nutrition/recipe/[recipeId]',
      params: { recipeId, servings: String(servings) },
    });

  const addPhotoBusy = (mealId: string): boolean =>
    (photoUpload.isPending && photoUpload.variables?.mealId === mealId) || picking;

  return {
    removeOffPlan,
    sheetOpen,
    setSheetOpen,
    viewer,
    setViewer,
    askSource,
    openFood,
    removeEntry,
    openRecipe,
    addPhotoBusy,
  };
}
