import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem } from '@/api/generated';
import { formatWhole } from '@/components/nutrition/meal/format';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { formatRange, isoDay, localToday } from '@/components/nutrition/plan/model';
import { PlansSection } from '@/components/nutrition/plans/PlansSection';
import type { PlanListRow } from '@/components/nutrition/plans/PlansSection';
import { groupNutritionPlans, planEnd, planWeeks } from '@/components/nutrition/plans/model';
import { daysUntil } from '@/components/nutrition/upcoming/format';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useClientPlans } from '@/hooks/useClientPlans';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** "Mon 19 Oct" in the app language. */
const formatStart = (language: string, iso: string): string =>
  new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** "Your plans": the client's nutrition plans as Upcoming, Current and Past; a row opens that plan. */
export default function NutritionPlansScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const plans = useClientPlans();
  const language = i18n.language;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/nutrition'));

  const today = localToday();
  const sections = useMemo(() => groupNutritionPlans(plans.data, today), [plans.data, today]);

  if (plans.isPending) {
    return <PlanState kind="pending" onBack={goBack} />;
  }
  if (plans.isError) {
    return (
      <PlanState
        kind="error"
        title={t('nutritionPlan.error.title')}
        body={t('nutritionPlan.error.body')}
        onBack={goBack}
        onRetry={() => void plans.refetch()}
      />
    );
  }
  if (sections.upcoming.length + sections.current.length + sections.past.length === 0) {
    return (
      <PlanState
        kind="empty"
        title={t('nutritionPlans.empty.title')}
        body={t('nutritionPlans.empty.body')}
        onBack={goBack}
      />
    );
  }

  const weeks = (plan: ClientOwnPlanItem) => t('nutritionUpcoming.weeks', { count: planWeeks(plan) });
  const range = (plan: ClientOwnPlanItem) =>
    formatRange(language, isoDay(plan.startDate), planEnd(plan));
  const kcal = (plan: ClientOwnPlanItem) =>
    plan.dailyKcal ? t('nutritionPlan.meal.kcal', { value: formatWhole(language, plan.dailyKcal) }) : undefined;

  const upcoming: PlanListRow[] = sections.upcoming.map((plan) => ({
    planId: plan.planId ?? '',
    kind: 'future',
    title: plan.planName ?? '',
    subtitle: t('nutritionPlans.from', { date: formatStart(language, isoDay(plan.startDate)), weeks: weeks(plan) }),
    detail: t('nutritionUpcoming.inDays', { count: daysUntil(isoDay(plan.startDate), today) }),
    detailTone: 'accent',
  }));
  const current: PlanListRow[] = sections.current.map((plan) => ({
    planId: plan.planId ?? '',
    kind: 'current',
    title: plan.planName ?? '',
    subtitle: t('nutritionPlans.running', {
      range: range(plan),
      week: t('nutritionPlan.plan.weekOf', { week: plan.currentWeek ?? 1, total: planWeeks(plan) }),
    }),
    detail: kcal(plan),
    detailTone: 'muted',
  }));
  const past: PlanListRow[] = sections.past.map((plan) => ({
    planId: plan.planId ?? '',
    kind: 'past',
    title: plan.planName ?? '',
    subtitle: t('nutritionPlans.range', { range: range(plan), weeks: weeks(plan) }),
    detail: kcal(plan),
    detailTone: 'muted',
  }));

  const open = (planId: string) => router.push({ pathname: '/nutrition/plan', params: { planId } });

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <ScreenHeader
        title={t('nutritionPlans.title')}
        subtitle={t('today.areaBlocks.area.nutrition').toUpperCase()}
        subtitleColor="nutritionInk"
        backLabel={t('onboarding.back')}
        onBack={goBack}
      />
      <PlansSection title={t('nutritionPlans.upcoming')} rows={upcoming} onOpen={open} />
      <PlansSection title={t('nutritionPlans.current')} rows={current} onOpen={open} />
      <PlansSection title={t('nutritionPlans.past')} rows={past} onOpen={open} />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.md,
    },
  });
