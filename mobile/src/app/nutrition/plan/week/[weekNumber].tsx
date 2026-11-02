import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { FullPlanWeek, GetFullPlanResponse } from '@/api/generated';
import { getErrorStatus } from '@/api/errors';
import { MEAL_LOG_DATE_IN_FUTURE, getTopLevelErrorCode, storedWeekMealPhotos } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { PhotoUploadError } from '@/api/photos';
import type { PickedPhoto } from '@/api/photos';
import { Card } from '@/components/Card';
import { MealPhotoViewer } from '@/components/nutrition/meals/MealPhotoViewer';
import type { ViewerPhoto } from '@/components/nutrition/meals/MealPhotoViewer';
import { MealRow } from '@/components/nutrition/meals/MealRow';
import { pickMealPhoto } from '@/components/nutrition/meal/pickMealPhoto';
import type { PhotoSource } from '@/components/nutrition/meal/pickMealPhoto';
import { DayStrip } from '@/components/nutrition/plan/DayStrip';
import { DaySummary } from '@/components/nutrition/plan/DaySummary';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import {
  canAddPhotos,
  dayMeals,
  eatenMacros,
  findLoggedMeal,
  formatRange,
  isPlanFinished,
  isReadOnlyPlan,
  isoDay,
  localToday,
  mealStatus,
  parsePlanIdParam,
  weekDays,
  weekMealCount,
} from '@/components/nutrition/plan/model';
import { dayPhase } from '@/components/nutrition/tab/model';
import { RecipesToday } from '@/components/nutrition/week/RecipesToday';
import { WeekGlance } from '@/components/nutrition/week/WeekGlance';
import { dayRecipes, dayWithinWeek } from '@/components/nutrition/week/model';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAddDayMealPhoto } from '@/hooks/useAddDayMealPhoto';
import { useClientRecipes } from '@/hooks/useClientRecipes';
import { useFullNutritionPlan } from '@/hooks/useFullNutritionPlan';
import { useHorizontalSwipe, useSlideTransition } from '@/hooks/useHorizontalSwipe';
import type { SwipeDirection } from '@/hooks/useHorizontalSwipe';
import { useNutritionDayLog } from '@/hooks/useNutritionDayLog';
import { isOfflineEmpty, showsError } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PhotoFailure = 'tooLarge' | 'unsupportedType' | 'upload' | 'future';

const photoFailure = (error: unknown): PhotoFailure => {
  if (getTopLevelErrorCode(error) === MEAL_LOG_DATE_IN_FUTURE) return 'future';
  const failure = error instanceof PhotoUploadError ? error.failure : 'upload';
  return failure === 'tooLarge' || failure === 'unsupportedType' ? failure : 'upload';
};

/** One published week of the plan: browse its days, see what was eaten, add photos to today's and past meals. */
export default function NutritionPlanWeekScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ weekNumber?: string; day?: string; planId?: string }>();
  const weekNumber = Number.parseInt(typeof params.weekNumber === 'string' ? params.weekNumber : '', 10);
  const planParam = parsePlanIdParam(params.planId);
  const planId = planParam.kind === 'valid' ? planParam.planId : undefined;
  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/nutrition/plan', params: planId ? { planId } : {} });

  if (planParam.kind === 'invalid') {
    return (
      <PlanState
        kind="empty"
        title={t('nutritionPlan.empty.title')}
        body={t('nutritionPlan.empty.body')}
        onBack={goBack}
      />
    );
  }
  return (
    <WeekLoader
      planId={planId}
      weekNumber={weekNumber}
      initialDay={typeof params.day === 'string' ? params.day : undefined}
      onBack={goBack}
    />
  );
}

type WeekLoaderProps = {
  planId: string | undefined;
  weekNumber: number;
  initialDay: string | undefined;
  onBack: () => void;
};

function WeekLoader({ planId, weekNumber, initialDay, onBack: goBack }: WeekLoaderProps) {
  const { t } = useTranslation();
  const plan = useFullNutritionPlan(planId);

  if (plan.isPending) {
    return <PlanState kind="pending" onBack={goBack} />;
  }
  if (isOfflineEmpty(plan)) {
    return <PlanState kind="offline" onBack={goBack} />;
  }
  if (showsError(plan) || !plan.data) {
    const missing = getErrorStatus(plan.error) === 404;
    return (
      <PlanState
        kind={missing ? 'empty' : 'error'}
        title={missing ? t('nutritionPlan.empty.title') : t('nutritionPlan.error.title')}
        body={missing ? t('nutritionPlan.empty.body') : t('nutritionPlan.error.body')}
        onBack={goBack}
        onRetry={() => void plan.refetch()}
      />
    );
  }
  const week = (plan.data.weeks ?? []).find((candidate) => candidate.weekNumber === weekNumber);
  if (!week) {
    return (
      <PlanState
        kind="empty"
        title={t('nutritionPlan.week.notFound.title')}
        body={t('nutritionPlan.week.notFound.body')}
        onBack={goBack}
      />
    );
  }
  return <WeekContent plan={plan.data} planId={planId} week={week} initialDay={initialDay} onBack={goBack} />;
}

type WeekContentProps = {
  plan: GetFullPlanResponse;
  /** The `planId` route param when the plan was opened by id. */
  planId: string | undefined;
  week: FullPlanWeek;
  /** The `day` route param, unvalidated; it is used only when it is a date of this week. */
  initialDay: string | undefined;
  onBack: () => void;
};

function WeekContent({ plan, planId, week, initialDay, onBack }: WeekContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const language = i18n.language;

  const weekNumber = week.weekNumber ?? 1;
  const weekStart = isoDay(week.weekStartDate);
  const weekEnd = isoDay(week.weekEndDate);
  const days = weekDays(week);
  const readOnly = isReadOnlyPlan(plan, planId !== undefined);
  // A browse-only plan has no week log to fetch; its eaten state comes from the plan's own eaten-meal set.
  const log = useNutritionDayLog(readOnly ? undefined : weekStart);
  const eatenIds = useMemo(() => new Set(plan.eatenMealIds ?? []), [plan.eatenMealIds]);
  const photoUpload = useAddDayMealPhoto();
  const [picking, setPicking] = useState(false);
  const [viewer, setViewer] = useState<{ mealId: string; index: number } | null>(null);

  // The server knows the client's local today; the device date only stands in until the log is loaded.
  const today = isoDay(log.data?.today) || localToday();
  const defaultDate =
    dayWithinWeek(days, initialDay) ?? (days.some(({ date }) => date === today) ? today : weekStart);
  const [picked, setPicked] = useState<{ weekNumber: number; date: string } | null>(null);
  const selected = picked && picked.weekNumber === weekNumber ? picked.date : defaultDate;
  const selectedDay = days.find(({ date }) => date === selected);
  const meals = dayMeals(selectedDay?.day);

  const logAvailable = readOnly || log.data !== undefined;
  const planFinished = isPlanFinished(plan);
  const isEaten = (date: string, mealId: string) =>
    readOnly ? eatenIds.has(mealId) : findLoggedMeal(log.data, date, mealId)?.eaten === true;

  const totalMeals = weekMealCount(week);
  const eatenMeals = days.reduce(
    (sum, { date, day }) => sum + dayMeals(day).filter((meal) => isEaten(date, meal.mealId)).length,
    0,
  );
  const dayEaten = meals.filter((meal) => isEaten(selected, meal.mealId)).length;

  const weeks = plan.weeks ?? [];
  const neighbour = (offset: number) => weeks.find((candidate) => candidate.weekNumber === weekNumber + offset);
  /** Opens another week; `day` picks the day to land on, otherwise the week's own default applies. */
  const goToWeek = (target: FullPlanWeek | undefined, day?: string) => {
    if (!target) return;
    const targetNumber = target.weekNumber ?? 1;
    setPicked(day ? { weekNumber: targetNumber, date: day } : null);
    // Same screen instance, new params: the swipe's slide-in then plays on the content that is already mounted.
    router.setParams({ weekNumber: String(targetNumber), day, ...(planId ? { planId } : {}) });
  };
  const previous = neighbour(-1);
  const next = neighbour(1);

  const swipeWeek = (direction: SwipeDirection) => {
    const target = direction === 'next' ? next : previous;
    if (target) goToWeek(target);
  };

  // Past the first or last day of the week the swipe continues into the neighbouring week, when there is one.
  const swipeDay = (direction: SwipeDirection) => {
    const index = days.findIndex(({ date }) => date === selected);
    const step = direction === 'next' ? 1 : -1;
    const inWeek = days[index + step];
    if (inWeek) {
      setPicked({ weekNumber, date: inWeek.date });
      return;
    }
    const target = direction === 'next' ? next : previous;
    if (!target) return;
    const targetDays = weekDays(target);
    const landing = direction === 'next' ? targetDays[0] : targetDays[targetDays.length - 1];
    goToWeek(target, landing?.date);
  };
  const dayIndex = days.findIndex(({ date }) => date === selected);
  const daySwipe = useHorizontalSwipe({
    onSwipe: swipeDay,
    canGoPrevious: dayIndex > 0 || previous !== undefined,
    canGoNext: (dayIndex >= 0 && dayIndex < days.length - 1) || next !== undefined,
    contentKey: `${weekNumber}-${selected}`,
  });
  // The part below the day content only changes with the week, so it slides only then.
  const belowSlide = useSlideTransition(String(weekNumber));
  // A week change (strip swipe or arrows) slides the day content and everything under it with the strip's days.
  const alsoSlide = useMemo(() => [daySwipe.transition, belowSlide], [daySwipe.transition, belowSlide]);
  const weekSwipe = useHorizontalSwipe({
    onSwipe: swipeWeek,
    canGoPrevious: previous !== undefined,
    canGoNext: next !== undefined,
    contentKey: String(weekNumber),
    alsoSlide,
  });

  const recipesQuery = useClientRecipes(plan.planId, Boolean(plan.planId));
  const recipeImages = useMemo(() => {
    const images = new Map<string, string>();
    for (const recipe of recipesQuery.data?.items ?? []) {
      if (recipe.recipeId && recipe.imageUrl) images.set(recipe.recipeId, recipe.imageUrl);
    }
    return images;
  }, [recipesQuery.data]);
  const recipes = dayRecipes(meals);

  const upload = (meal: NutritionMeal, photo: PickedPhoto) => {
    photoUpload.mutate(
      {
        mealId: meal.mealId,
        date: selected,
        photo,
        existing: storedWeekMealPhotos(findLoggedMeal(log.data, selected, meal.mealId)),
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

  const photosOf = (meal: NutritionMeal): ViewerPhoto[] =>
    (findLoggedMeal(log.data, selected, meal.mealId)?.photos ?? [])
      .filter((photo) => Boolean(photo.blobUrl) && Boolean(photo.displayUrl))
      .sort((first, second) => (first.uploadedAt ?? '').localeCompare(second.uploadedAt ?? ''))
      .map((photo) => ({
        key: photo.blobUrl ?? '',
        uri: photo.displayUrl ?? '',
        note: photo.note,
        uploadedAt: photo.uploadedAt,
      }));

  const viewerMeal = viewer ? meals.find((meal) => meal.mealId === viewer.mealId) : undefined;
  const viewerPhotos = viewerMeal ? photosOf(viewerMeal) : [];
  const hideEatenState = dayPhase(selected, today) === 'future';
  const showAddPhoto =!readOnly && logAvailable && canAddPhotos(log.data, selected);

  const subtitle = [
    formatRange(language, weekStart, weekEnd),
    logAvailable ? t('nutritionPlan.week.mealsOf', { done: eatenMeals, total: totalMeals }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Screen scroll gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap} bottomInset={theme.spacing.huge} contentStyle={styles.content}>
        <ScreenHeader
          title={t('nutritionPlan.week.title', { week: weekNumber, total: plan.totalWeeks ?? weeks.length })}
          subtitle={subtitle}
          backLabel={t('onboarding.back')}
          onBack={onBack}
        />

        <GestureDetector gesture={weekSwipe.gesture}>
          <View>
            <DayStrip
              days={days}
              selected={selected}
              today={today}
              onPreviousWeek={previous ? () => weekSwipe.slide('previous') : undefined}
              onNextWeek={next ? () => weekSwipe.slide('next') : undefined}
              onSelect={(date) => setPicked({ weekNumber, date })}
              daysStyle={weekSwipe.style}
            />
          </View>
        </GestureDetector>

        <GestureDetector gesture={daySwipe.gesture}>
          <Reanimated.View style={[styles.day, daySwipe.style]}>
        <DaySummary
          eaten={eatenMacros(meals, (mealId) => isEaten(selected, mealId))}
          targets={plan.globalSettings}
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

          {showsError(log) ? (
            <View style={styles.logError}>
              <Text variant="bodySmall" color="muted" style={styles.logErrorText}>
                {t('nutritionPlan.week.logError')}
              </Text>
              <Text variant="link" color="nutritionInk" accessibilityRole="button" onPress={() => void log.refetch()}>
                {t('nutritionPlan.retry')}
              </Text>
            </View>
          ) : null}

          {meals.length === 0 ? (
            <Text variant="bodySmall" color="muted" style={styles.empty}>
              {t('nutritionPlan.week.noMeals')}
            </Text>
          ) : (
            meals.map((meal, index) => {
              const photos = photosOf(meal);
              const busy = photoUpload.isPending && photoUpload.variables?.mealId === meal.mealId;
              return (
                <MealRow
                  // A new day or week remounts the rows so each starts collapsed.
                  key={`${weekNumber}-${selected}-${meal.mealId}`}
                  meal={meal}
                  first={index === 0}
                  status={mealStatus({
                    eaten: isEaten(selected, meal.mealId),
                    logAvailable,
                    date: selected,
                    today,
                    planFinished,
                  })}
                  photos={photos.map((photo) => ({ key: photo.key, uri: photo.uri }))}
                  onOpenRecipe={(recipeId, servings) =>
                    router.push({
                      pathname: '/nutrition/recipe/[recipeId]',
                      params: { recipeId, servings: String(servings) },
                    })
                  }
                  onOpenFood={(food) => {
                    if (!food.foodExternalId) return;
                    router.push({
                      pathname: '/nutrition/food/[foodId]',
                      params: {
                        foodId: food.foodExternalId,
                        grams: String(food.amountGrams ?? 0),
                        ...(meal.kind ? { meal: meal.kind } : {}),
                      },
                    });
                  }}
                  onAddPhoto={showAddPhoto ? () => askSource(meal) : undefined}
                  addPhotoBusy={busy || picking}
                  hideEatenState={hideEatenState}
                  onOpenPhoto={(photoIndex) => setViewer({ mealId: meal.mealId, index: photoIndex })}
                />
              );
            })
          )}
        </Card>
          </Reanimated.View>
        </GestureDetector>

        <Reanimated.View style={[styles.day, belowSlide.style]}>
        <WeekGlance
          days={days}
          selected={selected}
          today={today}
          target={plan.globalSettings?.dailyKcal}
          onSelect={(date) => setPicked({ weekNumber, date })}
        />

        <RecipesToday
          recipes={recipes}
          images={recipeImages}
          gutter={theme.spacing.xl}
          onOpenRecipe={(recipe) =>
            router.push({
              pathname: '/nutrition/recipe/[recipeId]',
              params: { recipeId: recipe.recipeId, servings: String(recipe.servings) },
            })
          }
          onOpenAll={() => router.push('/nutrition/recipes')}
        />
        </Reanimated.View>
      </Screen>

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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
    day: {
      gap: theme.spacing.xl,
    },
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
