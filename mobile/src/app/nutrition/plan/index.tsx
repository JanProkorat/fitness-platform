import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { FullPlanWeek, GetFullPlanResponse } from '@/api/generated';
import { getErrorStatus } from '@/api/errors';
import { Card } from '@/components/Card';
import { formatWhole } from '@/components/nutrition/meal/format';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { WeekRow } from '@/components/nutrition/plan/WeekRow';
import {
  dayMeals,
  eatenInWeek,
  formatRange,
  isoDay,
  localToday,
  parsePlanIdParam,
  planEndDate,
  weekDays,
  weekMealCount,
  weekPhase,
} from '@/components/nutrition/plan/model';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { calendarParts, daysUntil } from '@/components/nutrition/upcoming/format';
import { Text } from '@/components/Text';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useFullNutritionPlan } from '@/hooks/useFullNutritionPlan';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const percent = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The whole nutrition plan: progress, and every week to open. `planId` opens a specific plan. */
export default function NutritionPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string }>();
  const planParam = parsePlanIdParam(params.planId);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

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
  return <PlanLoader planId={planParam.kind === 'valid' ? planParam.planId : undefined} onBack={goBack} />;
}

function PlanLoader({ planId, onBack }: { planId: string | undefined; onBack: () => void }) {
  const { t } = useTranslation();
  const plan = useFullNutritionPlan(planId);

  if (plan.isPending) {
    return <PlanState kind="pending" onBack={onBack} />;
  }
  if (plan.isError || !plan.data) {
    const missing = getErrorStatus(plan.error) === 404;
    return (
      <PlanState
        kind={missing ? 'empty' : 'error'}
        title={missing ? t('nutritionPlan.empty.title') : t('nutritionPlan.error.title')}
        body={missing ? t('nutritionPlan.empty.body') : t('nutritionPlan.error.body')}
        onBack={onBack}
        onRetry={() => void plan.refetch()}
      />
    );
  }
  return <PlanContent plan={plan.data} planId={planId} onBack={onBack} />;
}

type PlanContentProps = {
  plan: GetFullPlanResponse;
  /** The `planId` route param when the plan was opened by id; carried on to the week screen. */
  planId: string | undefined;
  onBack: () => void;
};

function PlanContent({ plan, planId, onBack }: PlanContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const language = i18n.language;
  const collaborations = useCollaborations();
  const [pastOpen, setPastOpen] = useState(false);

  const today = localToday();
  const weeks = plan.weeks ?? [];
  const eatenIds = new Set(plan.eatenMealIds ?? []);
  const totalWeeks = plan.totalWeeks ?? weeks.length;
  const nutritionist = (collaborations.data ?? []).find((entry) => entry.role?.includes('Nutritionist'));
  const coachName = nutritionist?.professionalName;
  const startDate = isoDay(plan.startDate);
  const range = startDate ? formatRange(language, startDate, planEndDate(startDate, totalWeeks)) : '';
  const notStarted = startDate !== '' && startDate > today;
  const startsIn = notStarted ? daysUntil(startDate, today) : 0;
  // calendarParts is UTC-parsed (0 = Sunday); the copy keys are ISO weekdays (1 = Monday, 7 = Sunday).
  const startWeekday = calendarParts(language, plan.startDate).weekday;

  const openWeek = (week: FullPlanWeek) => {
    router.push({
      pathname: '/nutrition/plan/week/[weekNumber]',
      params: { weekNumber: String(week.weekNumber ?? 1), ...(planId ? { planId } : {}) },
    });
  };

  const current = weeks.find((week) => weekPhase(week, today) === 'current');
  const currentNumber = current?.weekNumber;
  const pastWeeks = weeks.filter((week) => weekPhase(week, today) === 'past');

  // Meals of days up to today, so the share logged is not diluted by days still ahead.
  let elapsed = 0;
  let elapsedEaten = 0;
  let planned = 0;
  let plannedDays = 0;
  for (const week of weeks) {
    for (const { date, day } of weekDays(week)) {
      const meals = dayMeals(day);
      if (meals.length > 0) {
        planned += meals.length;
        plannedDays += 1;
      }
      if (date <= today) {
        elapsed += meals.length;
        elapsedEaten += meals.filter((meal) => eatenIds.has(meal.mealId)).length;
      }
    }
  }
  const perDay = plannedDays > 0 ? Math.round(planned / plannedDays) : 0;
  const kcalTarget = plan.globalSettings?.dailyKcal;

  const pastRows = (
    <>
      {pastWeeks.map((week, index) => (
        <WeekRow
          key={`past-${week.weekNumber ?? index}`}
          kind="past"
          title={t('nutritionPlan.plan.week', { week: week.weekNumber })}
          subtitle={formatRange(language, isoDay(week.weekStartDate), isoDay(week.weekEndDate))}
          detail={t('nutritionPlan.plan.ofTotal', { done: eatenInWeek(week, eatenIds), total: weekMealCount(week) })}
          onPress={() => openWeek(week)}
        />
      ))}
    </>
  );

  const publishedNumbers = new Set(weeks.map((week) => week.weekNumber));
  const preparing = Array.from({ length: totalWeeks }, (_, index) => index + 1).filter(
    (number) => !publishedNumbers.has(number),
  );

  const groupPastWeeks = pastWeeks.length >= 2;
  const firstPast = pastWeeks[0];
  const lastPast = pastWeeks[pastWeeks.length - 1];
  const pastPlanned = pastWeeks.reduce((sum, week) => sum + weekMealCount(week), 0);
  const pastEaten = pastWeeks.reduce((sum, week) => sum + eatenInWeek(week, eatenIds), 0);
  const futureWeeks = weeks.filter((week) => weekPhase(week, today) === 'future');
  const rows: ReactNode[] = [];

  if (groupPastWeeks && firstPast && lastPast) {
    rows.push(
      <WeekRow
        key="past-group"
        kind="group"
        first
        expanded={pastOpen}
        title={t('nutritionPlan.plan.weeksRange', { from: firstPast.weekNumber, to: lastPast.weekNumber })}
        subtitle={formatRange(language, isoDay(firstPast.weekStartDate), isoDay(lastPast.weekEndDate))}
        detail={t('nutritionPlan.plan.loggedShare', { value: percent(pastEaten, pastPlanned) })}
        onPress={() => setPastOpen((value) => !value)}
        accessibilityLabel={t('nutritionPlan.plan.togglePast')}
      />,
    );
    if (pastOpen) rows.push(<View key="past-rows">{pastRows}</View>);
  } else {
    rows.push(<View key="past-rows">{pastRows}</View>);
  }

  if (current) {
    rows.push(
      <WeekRow
        key="current"
        kind="current"
        title={t('nutritionPlan.plan.thisWeek', { week: current.weekNumber })}
        subtitle={formatRange(language, isoDay(current.weekStartDate), isoDay(current.weekEndDate))}
        detail={t('nutritionPlan.plan.ofMeals', { done: eatenInWeek(current, eatenIds), total: weekMealCount(current) })}
        onPress={() => openWeek(current)}
      />,
    );
  }
  for (const week of futureWeeks) {
    rows.push(
      <WeekRow
        key={`future-${week.weekNumber}`}
        kind="future"
        title={t('nutritionPlan.plan.week', { week: week.weekNumber })}
        subtitle={t('nutritionPlan.plan.published', {
          range: formatRange(language, isoDay(week.weekStartDate), isoDay(week.weekEndDate)),
        })}
        detail={kcalTarget ? t('nutritionPlan.meal.kcal', { value: formatWhole(language, kcalTarget) }) : undefined}
        onPress={() => openWeek(week)}
      />,
    );
  }
  for (const number of preparing) {
    rows.push(
      <WeekRow
        key={`preparing-${number}`}
        kind="preparing"
        title={t('nutritionPlan.plan.week', { week: number })}
        subtitle={
          coachName
            ? t('nutritionPlan.plan.preparing', { name: coachName })
            : t('nutritionPlan.plan.preparingGeneric')
        }
      />,
    );
  }

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <ScreenHeader title={plan.planName ?? t('nutritionPlan.title')} backLabel={t('onboarding.back')} onBack={onBack} />

      {coachName || range ? (
        <View style={styles.coach}>
          {coachName ? (
            <View style={styles.avatar}>
              <Text variant="micro" color="onAvatar">
                {initials(coachName)}
              </Text>
            </View>
          ) : null}
          <Text variant="label" color="muted" numberOfLines={1} style={styles.coachName}>
            {[coachName, range].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}

      <Card style={styles.progress}>
        {notStarted ? (
          <View style={styles.progressHead}>
            <Text variant="bodyStrong" style={styles.startsCopy}>
              {t('nutritionPlan.plan.startsOn', {
                weekday: t(`today.areaBlocks.weekday.${startWeekday === 0 ? 7 : startWeekday}`),
              })}{' '}
              <Text variant="body" color="muted">
                {t('nutritionUpcoming.inDays', { count: startsIn })}
              </Text>
            </Text>
            <Text variant="labelStrong" color="nutritionInk">
              {t('nutritionUpcoming.weeks', { count: totalWeeks })}
            </Text>
          </View>
        ) : (
          <View style={styles.progressHead}>
            <Text variant="bodyStrong">
              {currentNumber
                ? t('nutritionPlan.plan.weekOf', { week: currentNumber, total: totalWeeks })
                : t('nutritionPlan.plan.weeksTotal', { total: totalWeeks })}
            </Text>
            {currentNumber && totalWeeks > 0 ? (
              <Text variant="labelStrong" color="nutritionInk">
                {`${percent(currentNumber, totalWeeks)}%`}
              </Text>
            ) : null}
          </View>
        )}
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${currentNumber ? percent(currentNumber, totalWeeks) : 0}%` }]}
          />
        </View>
        <View style={styles.stats}>
          <Stat
            label={t('nutritionPlan.plan.dailyTarget')}
            value={kcalTarget ? t('nutritionPlan.meal.kcal', { value: formatWhole(language, kcalTarget) }) : '–'}
          />
          {notStarted ? (
            <Stat
              label={t('nutritionPlan.plan.publishedOf')}
              value={t('nutritionPlan.plan.publishedCount', { published: weeks.length, total: totalWeeks })}
            />
          ) : (
            <Stat
              label={t('nutritionPlan.plan.mealsLogged')}
              value={elapsed > 0 ? t('nutritionPlan.plan.percent', { value: percent(elapsedEaten, elapsed) }) : '–'}
            />
          )}
          <Stat label={t('nutritionPlan.plan.mealsPerDay')} value={perDay > 0 ? String(perDay) : '–'} />
        </View>
      </Card>

      <View style={styles.sectionHead}>
        <Text variant="overline" color="muted">
          {t('nutritionPlan.plan.weeks').toUpperCase()}
        </Text>
        <Text variant="caption" color="muted">
          {t('nutritionPlan.plan.weeksHint')}
        </Text>
      </View>
      <Card style={styles.weeks}>{rows}</Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.stat}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.md,
    },
    coach: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxs,
    },
    coachName: {
      flex: 1,
    },
    avatar: {
      width: theme.sizes.mealStatus,
      height: theme.sizes.mealStatus,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    progress: {
      gap: theme.spacing.md,
      padding: theme.spacing.cardInset,
    },
    progressHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    startsCopy: {
      flex: 1,
    },
    track: {
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    fill: {
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.nutrition,
    },
    stats: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    stat: {
      flex: 1,
      gap: theme.spacing.hair,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xxs,
      paddingTop: theme.spacing.xxs,
    },
    weeks: {
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.cardInset,
    },
  });
