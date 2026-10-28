import type { ClientOwnPlanItem } from '@/api/generated';
import { isActivePlan, planKind } from '@/api/plans';
import { isoDay } from '@/components/nutrition/plan/model';
import { useClientPlans } from '@/hooks/useClientPlans';
import { useLocalDayChange } from '@/hooks/useLocalDayChange';

/**
 * The earliest Active nutrition plan with a published week that starts after `today` (`yyyy-MM-dd`).
 * Same rule as the server uses when it serves an upcoming plan.
 */
export function pickUpcomingNutritionPlan(
  plans: readonly ClientOwnPlanItem[] | undefined,
  today: string,
): ClientOwnPlanItem | undefined {
  let best: ClientOwnPlanItem | undefined;
  for (const plan of plans ?? []) {
    if (planKind(plan) !== 'nutrition' || !isActivePlan(plan)) continue;
    if ((plan.publishedWeekCount ?? 0) <= 0) continue;
    const start = isoDay(plan.startDate);
    if (start === '' || start <= today) continue;
    if (!best || start < isoDay(best.startDate)) best = plan;
  }
  return best;
}

/** The client's upcoming nutrition plan, if any; re-evaluated when the local day changes. */
export function useUpcomingNutritionPlan() {
  const plans = useClientPlans();
  const today = useLocalDayChange();
  return {
    plan: pickUpcomingNutritionPlan(plans.data, today),
    today,
    isPending: plans.isPending,
  };
}
