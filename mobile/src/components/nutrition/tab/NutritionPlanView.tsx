import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getErrorStatus } from '@/api/errors';
import type { GetWeekPlanResponse, MealFood } from '@/api/generated';
import {
  MEAL_LOG_DATE_IN_FUTURE,
  findMealLog,
  getTopLevelErrorCode,
  isMealEaten,
  mealPhotos,
  storedMealPhotos,
} from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { PhotoUploadError } from '@/api/photos';
import type { PickedPhoto } from '@/api/photos';
import { Card } from '@/components/Card';
import { EMPTY_MACROS, macrosOf } from '@/components/nutrition/meal/format';
import { pickMealPhoto } from '@/components/nutrition/meal/pickMealPhoto';
import type { PhotoSource } from '@/components/nutrition/meal/pickMealPhoto';
import { MealPhotoViewer } from '@/components/nutrition/meals/MealPhotoViewer';
import type { ViewerPhoto } from '@/components/nutrition/meals/MealPhotoViewer';
import { DayStrip } from '@/components/nutrition/plan/DayStrip';
import { DaySummary } from '@/components/nutrition/plan/DaySummary';
import { dayMeals, eatenMacros, findLoggedMeal, isoDay, localToday, mealStatus } from '@/components/nutrition/plan/model';
import { currentWeekDays, dayPhase, mondayOf } from '@/components/nutrition/tab/model';
import { OffPlanGroup } from '@/components/nutrition/tab/OffPlanGroup';
import { OffPlanSheet } from '@/components/nutrition/tab/OffPlanSheet';
import { TabMealRow } from '@/components/nutrition/tab/TabMealRow';
import { Text } from '@/components/Text';
import { useAddDayMealPhoto } from '@/hooks/useAddDayMealPhoto';
import { useNutritionDayLog } from '@/hooks/useNutritionDayLog';
import { useRemoveOffPlanFood } from '@/hooks/useOffPlanFood';
import { useTodayMealLog } from '@/hooks/useTodayMealLog';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PhotoFailure = 'tooLarge' | 'unsupportedType' | 'upload' | 'future';

const photoFailure = (error: unknown): PhotoFailure => {
  if (getTopLevelErrorCode(error) === MEAL_LOG_DATE_IN_FUTURE) return 'future';
  const failure = error instanceof PhotoUploadError ? error.failure : 'upload';
  return failure === 'tooLarge' || failure === 'unsupportedType' ? failure : 'upload';
};

type NutritionPlanViewProps = { week: GetWeekPlanResponse };

/** The published plan on the Nutrition tab: the week's days, the day's totals and meals, and off-plan food. */
export function NutritionPlanView({ week }: NutritionPlanViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const todayLog = useTodayMealLog(true);
  const weekLog = useNutritionDayLog(localToday());
  const photoUpload = useAddDayMealPhoto();
  const removeOffPlan = useRemoveOffPlanFood();
  const [picking, setPicking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ mealId: string; index: number } | null>(null);

  // The server knows the client's local today; the device date only stands in until the log is loaded.
  const today = isoDay(weekLog.data?.today) || localToday();
  const weekStart = isoDay(weekLog.data?.weekStartDate) || mondayOf(today);
  const days = currentWeekDays(weekStart, week.days);
  const selected = picked && days.some(({ date }) => date === picked) ? picked : today;
  const selectedDay = days.find(({ date }) => date === selected);
  const meals = dayMeals(selectedDay?.day);
  const phase = dayPhase(selected, today);
  const isToday = phase === 'today';

  const logAvailable = isToday ? todayLog.data !== undefined : weekLog.data !== undefined;
  const isEaten = (mealId: string): boolean =>
    isToday ? isMealEaten(findMealLog(todayLog.data, mealId)) : findLoggedMeal(weekLog.data, selected, mealId)?.eaten === true;

  const photosOf = (meal: NutritionMeal): ViewerPhoto[] =>
    (isToday
      ? mealPhotos(findMealLog(todayLog.data, meal.mealId)).map((photo) => ({
          key: photo.blobUrl,
          uri: photo.displayUrl,
          note: photo.note,
          uploadedAt: photo.uploadedAt,
        }))
      : (findLoggedMeal(weekLog.data, selected, meal.mealId)?.photos ?? [])
          .filter((photo) => Boolean(photo.blobUrl) && Boolean(photo.displayUrl))
          .sort((first, second) => (first.uploadedAt ?? '').localeCompare(second.uploadedAt ?? ''))
          .map((photo) => ({
            key: photo.blobUrl ?? '',
            uri: photo.displayUrl ?? '',
            note: photo.note,
            uploadedAt: photo.uploadedAt,
          })));

  const eaten =
    phase === 'future'
      ? EMPTY_MACROS
      : isToday
        ? todayLog.data
          ? macrosOf(todayLog.data.totalConsumed)
          : EMPTY_MACROS
        : eatenMacros(meals, isEaten);
  const dayEaten = meals.filter((meal) => isEaten(meal.mealId)).length;

  const upload = (meal: NutritionMeal, photo: PickedPhoto) => {
    photoUpload.mutate(
      {
        mealId: meal.mealId,
        date: today,
        photo,
        existing: storedMealPhotos(findMealLog(todayLog.data, meal.mealId)),
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

  const viewerMeal = viewer ? meals.find((meal) => meal.mealId === viewer.mealId) : undefined;
  const viewerPhotos = viewerMeal ? photosOf(viewerMeal) : [];
  const logFailed = isToday ? todayLog.isError : weekLog.isError;
  const offPlan = isToday ? (todayLog.data?.offPlanFoods ?? []) : [];

  return (
    <>
      <DayStrip
        days={days}
        selected={selected}
        today={today}
        hideWeekArrows
        onSelect={setPicked}
      />

      <DaySummary eaten={eaten} targets={week.globalSettings} />

      <Card style={styles.meals}>
        <View style={styles.mealsHead}>
          <Text variant="barTitle" accessibilityRole="header">
            {t('nutritionPlan.week.meals')}
          </Text>
          {logAvailable && meals.length > 0 ? (
            <Text variant="caption" color="muted">
              {t('nutritionPlan.week.logged', { done: dayEaten, total: meals.length })}
            </Text>
          ) : null}
        </View>

        {logFailed ? (
          <View style={styles.logError}>
            <Text variant="bodySmall" color="muted" style={styles.logErrorText}>
              {t('nutritionPlan.week.logError')}
            </Text>
            <Text
              variant="link"
              color="nutritionInk"
              accessibilityRole="button"
              onPress={() => void (isToday ? todayLog.refetch() : weekLog.refetch())}
            >
              {t('nutritionPlan.retry')}
            </Text>
          </View>
        ) : null}

        {meals.length === 0 ? (
          <Text variant="bodySmall" color="muted" style={styles.empty}>
            {t('nutritionPlan.week.noMeals')}
          </Text>
        ) : (
          meals.map((meal, index) => (
            <TabMealRow
              // A new day remounts the rows so each starts collapsed.
              key={`${selected}-${meal.mealId}`}
              meal={meal}
              first={index === 0}
              status={mealStatus({
                eaten: isEaten(meal.mealId),
                logAvailable,
                date: selected,
                today,
                planFinished: false,
              })}
              photos={photosOf(meal).map((photo) => ({ key: photo.key, uri: photo.uri }))}
              canLog={isToday && logAvailable}
              onOpenRecipe={(recipeId, servings) =>
                router.push({
                  pathname: '/nutrition/recipe/[recipeId]',
                  params: { recipeId, servings: String(servings) },
                })
              }
              onOpenFood={(food: MealFood, parent: NutritionMeal) =>
                openFood(food.foodExternalId, food.amountGrams, parent.kind)
              }
              onAddPhoto={isToday && logAvailable ? () => askSource(meal) : undefined}
              addPhotoBusy={(photoUpload.isPending && photoUpload.variables?.mealId === meal.mealId) || picking}
              onOpenPhoto={(photoIndex) => setViewer({ mealId: meal.mealId, index: photoIndex })}
            />
          ))
        )}

        <OffPlanGroup
          entries={offPlan}
          removingId={removeOffPlan.isPending ? removeOffPlan.variables : undefined}
          onOpenFood={(foodId) => openFood(foodId)}
          onRemove={removeEntry}
          onAdd={isToday && logAvailable ? () => setSheetOpen(true) : undefined}
        />
      </Card>

      <OffPlanSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      <MealPhotoViewer
        title={viewerMeal?.kind ? t(`nutritionMeal.kind.${viewerMeal.kind}`) : t('nutritionMeal.title')}
        photos={viewerPhotos}
        index={viewer && viewerPhotos.length > 0 ? Math.min(viewer.index, viewerPhotos.length - 1) : null}
        onIndexChange={(index) => setViewer((current) => (current ? { ...current, index } : current))}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

/** Whether a failed week-plan call means "no plan yet" rather than a real error. */
export const isMissingPlan = (error: unknown): boolean => getErrorStatus(error) === 404;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    meals: {
      paddingHorizontal: theme.spacing.cardInset,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxs,
    },
    mealsHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.snug,
    },
    logError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    logErrorText: {
      flex: 1,
    },
    empty: {
      paddingVertical: theme.spacing.xl,
      textAlign: 'center',
    },
  });
