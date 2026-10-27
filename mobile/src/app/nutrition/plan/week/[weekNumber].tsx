import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  isoDay,
  localToday,
  mealStatus,
  weekDays,
  weekMealCount,
} from '@/components/nutrition/plan/model';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAddDayMealPhoto } from '@/hooks/useAddDayMealPhoto';
import { useFullNutritionPlan } from '@/hooks/useFullNutritionPlan';
import { useNutritionDayLog } from '@/hooks/useNutritionDayLog';
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
  const params = useLocalSearchParams<{ weekNumber?: string }>();
  const weekNumber = Number.parseInt(typeof params.weekNumber === 'string' ? params.weekNumber : '', 10);
  const plan = useFullNutritionPlan();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/nutrition/plan'));

  if (plan.isPending) {
    return <PlanState kind="pending" onBack={goBack} />;
  }
  if (plan.isError || !plan.data) {
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
  return <WeekContent plan={plan.data} week={week} onBack={goBack} />;
}

type WeekContentProps = { plan: GetFullPlanResponse; week: FullPlanWeek; onBack: () => void };

function WeekContent({ plan, week, onBack }: WeekContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const language = i18n.language;

  const weekNumber = week.weekNumber ?? 1;
  const weekStart = isoDay(week.weekStartDate);
  const weekEnd = isoDay(week.weekEndDate);
  const days = weekDays(week);
  const log = useNutritionDayLog(weekStart);
  const photoUpload = useAddDayMealPhoto();
  const [picking, setPicking] = useState(false);
  const [viewer, setViewer] = useState<{ mealId: string; index: number } | null>(null);

  // The server knows the client's local today; the device date only stands in until the log is loaded.
  const today = isoDay(log.data?.today) || localToday();
  const defaultDate = days.some(({ date }) => date === today) ? today : weekStart;
  const [picked, setPicked] = useState<{ weekNumber: number; date: string } | null>(null);
  const selected = picked && picked.weekNumber === weekNumber ? picked.date : defaultDate;
  const selectedDay = days.find(({ date }) => date === selected);
  const meals = dayMeals(selectedDay?.day);

  const logAvailable = log.data !== undefined;
  const planFinished = isPlanFinished(plan);
  const isEaten = (date: string, mealId: string) => findLoggedMeal(log.data, date, mealId)?.eaten === true;

  const totalMeals = weekMealCount(week);
  const eatenMeals = days.reduce(
    (sum, { date, day }) => sum + dayMeals(day).filter((meal) => isEaten(date, meal.mealId)).length,
    0,
  );
  const dayEaten = meals.filter((meal) => isEaten(selected, meal.mealId)).length;

  const weeks = plan.weeks ?? [];
  const neighbour = (offset: number) => weeks.find((candidate) => candidate.weekNumber === weekNumber + offset);
  const goToWeek = (target: FullPlanWeek | undefined) => {
    if (!target) return;
    router.replace({
      pathname: '/nutrition/plan/week/[weekNumber]',
      params: { weekNumber: String(target.weekNumber ?? 1) },
    });
  };
  const previous = neighbour(-1);
  const next = neighbour(1);

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
  const showAddPhoto = logAvailable && canAddPhotos(log.data, selected);

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

        <DayStrip
          days={days}
          selected={selected}
          today={today}
          onPreviousWeek={previous ? () => goToWeek(previous) : undefined}
          onNextWeek={next ? () => goToWeek(next) : undefined}
          onSelect={(date) => setPicked({ weekNumber, date })}
        />

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

          {log.isError ? (
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
                  onAddPhoto={showAddPhoto ? () => askSource(meal) : undefined}
                  addPhotoBusy={busy || picking}
                  onOpenPhoto={(photoIndex) => setViewer({ mealId: meal.mealId, index: photoIndex })}
                />
              );
            })
          )}
        </Card>
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
