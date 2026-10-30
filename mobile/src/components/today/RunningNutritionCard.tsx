import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem, MealFood } from '@/api/generated';
import { findMealLog, isMealEaten, mealPhotos } from '@/api/nutrition';
import type { NutritionMeal } from '@/api/nutrition';
import { Card } from '@/components/Card';
import { EMPTY_MACROS, formatWhole, macrosOf } from '@/components/nutrition/meal/format';
import { MealPhotoViewer } from '@/components/nutrition/meals/MealPhotoViewer';
import type { ViewerPhoto } from '@/components/nutrition/meals/MealPhotoViewer';
import { dayMeals, isoDay, mealStatus } from '@/components/nutrition/plan/model';
import { currentWeekDays, mondayOf } from '@/components/nutrition/tab/model';
import { OffPlanGroup } from '@/components/nutrition/tab/OffPlanGroup';
import { OffPlanSheet } from '@/components/nutrition/tab/OffPlanSheet';
import { TabMealRow } from '@/components/nutrition/tab/TabMealRow';
import { Text } from '@/components/Text';
import { useNutritionDayLog } from '@/hooks/useNutritionDayLog';
import { useNutritionWeekPlan } from '@/hooks/useNutritionWeekPlan';
import { useTodayMealActions } from '@/hooks/useTodayMealActions';
import { useTodayMealLog } from '@/hooks/useTodayMealLog';
import { showsError } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { roleLook } from './roleLook';

type RunningNutritionCardProps = {
  plan: ClientOwnPlanItem;
  /** Local today as `yyyy-MM-dd`, until the server's client-local today is known. */
  today: string;
  /** Shown at the bottom of the card, e.g. the next-plan strip. */
  footer?: ReactNode;
};

/** The running nutrition plan on Today: week, kcal against target, and today's meals as on the Nutrition tab. */
export function RunningNutritionCard({ plan, today: deviceToday, footer }: RunningNutritionCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = roleLook(theme, 'Nutritionist');
  const language = i18n.language;

  const weekPlan = useNutritionWeekPlan();
  const todayLog = useTodayMealLog(true);
  const dayLog = useNutritionDayLog(deviceToday);
  // The server knows the client's local today; the device date only stands in until it is loaded.
  const today = isoDay(dayLog.data?.today) || deviceToday;
  const actions = useTodayMealActions(todayLog.data, today);

  const week = weekPlan.data;
  // No published week (404) or a failed read: there is no meal list to show.
  if (!week) return null;

  const weekStart = isoDay(dayLog.data?.weekStartDate) || mondayOf(today);
  const todayPlanDay = currentWeekDays(weekStart, week.days).find(({ date }) => date === today);
  const meals = dayMeals(todayPlanDay?.day);

  const logAvailable = todayLog.data !== undefined;
  const isEaten = (mealId: string): boolean => isMealEaten(findMealLog(todayLog.data, mealId));
  const photosOf = (meal: NutritionMeal): ViewerPhoto[] =>
    mealPhotos(findMealLog(todayLog.data, meal.mealId)).map((photo) => ({
      key: photo.blobUrl,
      uri: photo.displayUrl,
      note: photo.note,
      uploadedAt: photo.uploadedAt,
    }));

  const eaten = todayLog.data ? macrosOf(todayLog.data.totalConsumed) : EMPTY_MACROS;
  const target = week.globalSettings?.dailyKcal ?? plan.dailyKcal;
  const ratio = target && target > 0 ? Math.min(Math.max(eaten.kcal / target, 0), 1) : 0;
  const current = plan.currentWeek ?? week.weekNumber;
  const weekLabel =
    current === undefined
      ? ''
      : plan.totalWeeks
        ? t('today.runningNutrition.weekOf', { current, total: plan.totalWeeks })
        : t('today.runningNutrition.week', { current });

  // Rows read their initial expansion once, so they wait for the log and are keyed by meal alone.
  const nextMealId = logAvailable ? meals.find((meal) => !isEaten(meal.mealId))?.mealId : undefined;
  const showRows = !todayLog.isPending;

  const viewerMeal = actions.viewer ? meals.find((meal) => meal.mealId === actions.viewer?.mealId) : undefined;
  const viewerPhotos = viewerMeal ? photosOf(viewerMeal) : [];
  const offPlan = todayLog.data?.offPlanFoods ?? [];

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.area}>
          <SymbolView name={look.symbol} tintColor={look.ink} size={theme.sizes.roleBadgeGlyph} />
          <Text variant="captionStrong" style={[styles.areaText, { color: look.ink }]}>
            {t('today.areaBlocks.area.nutrition').toUpperCase()}
          </Text>
        </View>
        {weekLabel ? (
          <Text variant="caption" color="muted" numberOfLines={1} style={styles.week}>
            {`· ${weekLabel}`}
          </Text>
        ) : null}
        <Text
          variant="label"
          style={styles.kcal}
          accessibilityLabel={
            target
              ? t('nutritionPlan.summary.ringOf', {
                  value: formatWhole(language, eaten.kcal),
                  target: formatWhole(language, target),
                })
              : t('nutritionPlan.summary.ringValue', { value: formatWhole(language, eaten.kcal) })
          }
        >
          <Text variant="labelStrong">{formatWhole(language, eaten.kcal)}</Text>
          <Text variant="label" color="muted">
            {target
              ? t('today.runningNutrition.ofKcal', { target: formatWhole(language, target) })
              : t('today.runningNutrition.kcal')}
          </Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: theme.colors.nutrition, width: `${Math.round(ratio * 100)}%` }]} />
      </View>

      {showsError(todayLog) ? (
        <View style={styles.logError}>
          <Text variant="bodySmall" color="muted" style={styles.logErrorText}>
            {t('nutritionPlan.week.logError')}
          </Text>
          <Text variant="link" color="nutritionInk" accessibilityRole="button" onPress={() => void todayLog.refetch()}>
            {t('nutritionPlan.retry')}
          </Text>
        </View>
      ) : null}

      {meals.length === 0 ? (
        <Text variant="bodySmall" color="muted" style={styles.empty}>
          {t('nutritionPlan.week.noMeals')}
        </Text>
      ) : showRows ? (
        meals.map((meal, index) => (
          <TabMealRow
            key={meal.mealId}
            meal={meal}
            first={index === 0}
            defaultExpanded={meal.mealId === nextMealId}
            status={mealStatus({
              eaten: isEaten(meal.mealId),
              logAvailable,
              date: today,
              today,
              planFinished: false,
            })}
            photos={photosOf(meal).map((photo) => ({ key: photo.key, uri: photo.uri }))}
            canLog={logAvailable}
            onOpenRecipe={actions.openRecipe}
            onOpenFood={(food: MealFood, parent: NutritionMeal) =>
              actions.openFood(food.foodExternalId, food.amountGrams, parent.kind)
            }
            onAddPhoto={logAvailable ? () => actions.askSource(meal) : undefined}
            addPhotoBusy={actions.addPhotoBusy(meal.mealId)}
            onOpenPhoto={(photoIndex) => actions.setViewer({ mealId: meal.mealId, index: photoIndex })}
          />
        ))
      ) : null}

      <OffPlanGroup
        entries={offPlan}
        removingId={actions.removeOffPlan.isPending ? actions.removeOffPlan.variables : undefined}
        onOpenFood={(foodId) => actions.openFood(foodId)}
        onRemove={actions.removeEntry}
        onAdd={logAvailable ? () => actions.setSheetOpen(true) : undefined}
      />

      {footer ? <View style={styles.footer}>{footer}</View> : null}

      <OffPlanSheet visible={actions.sheetOpen} onClose={() => actions.setSheetOpen(false)} />

      <MealPhotoViewer
        title={viewerMeal?.kind ? t(`nutritionMeal.kind.${viewerMeal.kind}`) : t('nutritionMeal.title')}
        photos={viewerPhotos}
        index={
          actions.viewer && viewerPhotos.length > 0 ? Math.min(actions.viewer.index, viewerPhotos.length - 1) : null
        }
        onIndexChange={(index) => actions.setViewer((current) => (current ? { ...current, index } : current))}
        onClose={() => actions.setViewer(null)}
      />
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.cardInset,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xxs,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    area: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.snug,
    },
    areaText: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    week: {
      flexShrink: 1,
    },
    kcal: {
      marginLeft: 'auto',
    },
    track: {
      height: theme.sizes.areaProgressBar,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    fill: {
      height: theme.sizes.areaProgressBar,
      borderRadius: theme.radii.xs,
    },
    logError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xxs,
    },
    logErrorText: {
      flex: 1,
    },
    footer: {
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.cardInset,
    },
    empty: {
      paddingVertical: theme.spacing.xl,
      textAlign: 'center',
    },
  });
