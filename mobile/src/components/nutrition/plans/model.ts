import type { ClientOwnPlanItem } from '@/api/generated';
import { isActivePlan, planKind } from '@/api/plans';
import { isoDay, planEndDate } from '@/components/nutrition/plan/model';
import { isRunningPlan, pickUpcomingPlan } from '@/components/today/todayBlocks';

export type PlanSections = {
  upcoming: ClientOwnPlanItem[];
  current: ClientOwnPlanItem[];
  past: ClientOwnPlanItem[];
};

const COMPLETED_STATUS = 'Completed';

const startOf = (plan: ClientOwnPlanItem): string => isoDay(plan.startDate);

/** Whole weeks the plan has, at least one. */
export const planWeeks = (plan: ClientOwnPlanItem): number => Math.max(plan.totalWeeks ?? 0, 1);

/** Last calendar day of the plan (`yyyy-MM-dd`), or empty when it has no start date. */
export const planEnd = (plan: ClientOwnPlanItem): string => {
  const start = startOf(plan);
  return start ? planEndDate(start, planWeeks(plan)) : '';
};

/**
 * The client's nutrition plans split for the "Your plans" list. Upcoming follows the Today rule (an Active plan
 * with a published week that starts later), earliest first. Current is a running Active plan; Past is a Completed
 * plan or an Active one whose window has ended, newest first. Drafts, archived plans and Active plans with nothing
 * published are left out, because the server would not open them.
 */
export function groupNutritionPlans(plans: readonly ClientOwnPlanItem[] | undefined, today: string): PlanSections {
  const nutrition = (plans ?? []).filter((plan) => planKind(plan) === 'nutrition' && plan.planId !== undefined);

  const upcoming: ClientOwnPlanItem[] = [];
  let rest = nutrition;
  for (let next = pickUpcomingPlan(rest, 'nutrition', today); next; next = pickUpcomingPlan(rest, 'nutrition', today)) {
    upcoming.push(next);
    rest = rest.filter((plan) => plan !== next);
  }

  const newestFirst = (first: ClientOwnPlanItem, second: ClientOwnPlanItem) =>
    startOf(second).localeCompare(startOf(first));
  const current: ClientOwnPlanItem[] = [];
  const past: ClientOwnPlanItem[] = [];
  for (const plan of rest) {
    if (plan.status === COMPLETED_STATUS) {
      past.push(plan);
    } else if (isRunningPlan(plan, today)) {
      current.push(plan);
    } else if (isActivePlan(plan) && (plan.publishedWeekCount ?? 0) > 0 && startOf(plan) !== '' && startOf(plan) <= today) {
      past.push(plan);
    }
  }
  return { upcoming, current: current.sort(newestFirst), past: past.sort(newestFirst) };
}
