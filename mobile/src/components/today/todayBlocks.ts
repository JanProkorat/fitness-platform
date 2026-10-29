import type { Collaboration } from '@/api/collaborations';
import type { ClientOwnPlanItem } from '@/api/generated';
import { isActivePlan, planKind } from '@/api/plans';
import type { PlanKind } from '@/api/plans';
import { isoDay } from '@/components/nutrition/plan/model';

import { COACH_ROLES } from './collaborationRoles';
import type { CoachRole, CoveredCollaboration } from './collaborationRoles';

/** What one area (training or nutrition) of Today shows. */
export type AreaState =
  /** An Active plan is under way; its block is not part of this selector yet. */
  | { kind: 'running' }
  /** An Active plan with a published week whose start date is still ahead. */
  | { kind: 'startsLater'; plan: ClientOwnPlanItem }
  /** A coach covers the area but no plan is published yet. */
  | { kind: 'building'; collaboration: Collaboration }
  /** Nobody covers the area. */
  | { kind: 'noCoach' };

export type AreaBlock = { role: CoachRole; state: AreaState };

const startOf = (plan: ClientOwnPlanItem): string => isoDay(plan.startDate);

/**
 * The earliest Active plan of `kind` with a published week that starts after `today` (`yyyy-MM-dd`).
 * Same rule as the server uses when it serves an upcoming plan.
 */
export function pickUpcomingPlan(
  plans: readonly ClientOwnPlanItem[] | undefined,
  kind: PlanKind,
  today: string,
): ClientOwnPlanItem | undefined {
  let best: ClientOwnPlanItem | undefined;
  for (const plan of plans ?? []) {
    if (planKind(plan) !== kind || !isActivePlan(plan)) continue;
    if ((plan.publishedWeekCount ?? 0) <= 0) continue;
    const start = startOf(plan);
    if (start === '' || start <= today) continue;
    if (!best || start < startOf(best)) best = plan;
  }
  return best;
}

/**
 * One block state per area, training first. Null when no area has an Active plan, which leaves
 * Today to its coach-progress view. `covering` holds the collaborations that cover at least one role.
 */
export function selectAreaBlocks(
  plans: readonly ClientOwnPlanItem[],
  covering: readonly CoveredCollaboration[],
  today: string,
): AreaBlock[] | null {
  if (!plans.some(isActivePlan)) return null;

  return COACH_ROLES.map((role): AreaBlock => {
    const kind: PlanKind = role === 'Nutritionist' ? 'nutrition' : 'training';
    const upcoming = pickUpcomingPlan(plans, kind, today);
    const active = plans.filter((plan) => planKind(plan) === kind && isActivePlan(plan));
    // An Active plan that is not the upcoming one is under way, even if another one is queued behind it.
    if (active.some((plan) => plan !== upcoming)) return { role, state: { kind: 'running' } };
    if (upcoming) return { role, state: { kind: 'startsLater', plan: upcoming } };
    const coach = covering.find((entry) => entry.roles.includes(role));
    if (coach) return { role, state: { kind: 'building', collaboration: coach.collaboration } };
    return { role, state: { kind: 'noCoach' } };
  });
}
