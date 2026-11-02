import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorStatus } from '@/api/errors';
import type { GetWeekPlanResponse, MealFood } from '@/api/generated';
import { findMealLog, isMealEaten, isMealPartlyEaten, mealPhotos } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { Card } from '@/components/Card';
import { EMPTY_MACROS, macrosOf } from '@/components/nutrition/meal/format';
import { MealPhotoViewer } from '@/components/nutrition/meals/MealPhotoViewer';
import type { ViewerPhoto } from '@/components/nutrition/meals/MealPhotoViewer';
import { DayStrip } from '@/components/nutrition/plan/DayStrip';
import { DaySummary } from '@/components/nutrition/plan/DaySummary';
import { dayMeals, eatenMacros, findLoggedMeal, isoDay, localToday, mealStatus } from '@/components/nutrition/plan/model';
import { currentWeekDays, dayPhase, mondayOf } from '@/components/nutrition/tab/model';
import { OffPlanGroup } from '@/components/nutrition/tab/OffPlanGroup';
import { OffPlanSheet } from '@/components/nutrition/tab/OffPlanSheet';
import { TabMealRow } from '@/components/nutrition/tab/TabMealRow';
import { SyncNoticeCard } from '@/components/offline/SyncNoticeCard';
import { Text } from '@/components/Text';
import { useNutritionDayLog } from '@/hooks/useNutritionDayLog';
import { useTodayMealActions } from '@/hooks/useTodayMealActions';
import { useTodayMealLog } from '@/hooks/useTodayMealLog';
import { showsError } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NutritionPlanViewProps = { week: GetWeekPlanResponse };

/** The published plan on the Nutrition tab: the week's days, the day's totals and meals, and off-plan food. */
export function NutritionPlanView({ week }: NutritionPlanViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const todayLog = useTodayMealLog(true);
  const weekLog = useNutritionDayLog(localToday());
  const [picked, setPicked] = useState<string | null>(null);

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
  const logEntryOf = (mealId: string) =>
    isToday ? findMealLog(todayLog.data, mealId) : findLoggedMeal(weekLog.data, selected, mealId);
  const isEaten = (mealId: string): boolean =>
    isToday ? isMealEaten(findMealLog(todayLog.data, mealId)) : findLoggedMeal(weekLog.data, selected, mealId)?.eaten === true;
  // Only a row that can log today passes its ids on, so the food and recipe screens offer "Mark as eaten" there alone.
  const canLogToday = isToday && logAvailable;

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

  const {
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
  } = useTodayMealActions(todayLog.data, today);

  const viewerMeal = viewer ? meals.find((meal) => meal.mealId === viewer.mealId) : undefined;
  const viewerPhotos = viewerMeal ? photosOf(viewerMeal) : [];
  const logFailed = isToday ? showsError(todayLog) : showsError(weekLog);
  const offPlan = isToday ? (todayLog.data?.offPlanFoods ?? []) : [];

  return (
    <>
      <SyncNoticeCard />

      <DayStrip
        days={days}
        selected={selected}
        today={today}
        hideWeekArrows
        onSelect={setPicked}
      />

      <DaySummary
        eaten={eaten}
        targets={week.globalSettings}
        note={selectedDay?.day?.note}
        noteLabel={isToday ? t('nutritionPlan.note.today') : undefined}
      />

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
                partial: isMealPartlyEaten(logEntryOf(meal.mealId), isEaten(meal.mealId)),
                logAvailable,
                date: selected,
                today,
                planFinished: false,
              })}
              photos={photosOf(meal).map((photo) => ({ key: photo.key, uri: photo.uri }))}
              canLog={canLogToday}
              eatenItemIds={logEntryOf(meal.mealId)?.eatenItemIds}
              onOpenRecipe={(recipeId, servings, parent, itemId) =>
                openRecipe(recipeId, servings, canLogToday && parent && itemId ? { mealId: parent.mealId, itemId } : undefined)
              }
              onOpenFood={(food: MealFood, parent: NutritionMeal) =>
                openFood(
                  food.foodExternalId,
                  food.amountGrams,
                  parent.kind,
                  canLogToday && food.itemId ? { mealId: parent.mealId, itemId: food.itemId } : undefined,
                )
              }
              onAddPhoto={isToday && logAvailable ? () => askSource(meal) : undefined}
              addPhotoBusy={addPhotoBusy(meal.mealId)}
              hideEatenState={phase === 'future'}
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
