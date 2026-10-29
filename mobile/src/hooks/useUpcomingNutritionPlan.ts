import type { ClientOwnPlanItem } from '@/api/generated';
import { pickUpcomingPlan } from '@/components/today/todayBlocks';
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
  return pickUpcomingPlan(plans, 'nutrition', today);
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
