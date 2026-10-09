import type { PrimaryGoal } from '@/api/nutrition-plan-templates';
import { cn } from '@/lib/utils';
import { GOAL_STYLES } from '@/components/plan-templates/plan-template-tree';

/** Small coloured dot identifying a goal. */
export default function GoalDot({ goal, className }: { goal: PrimaryGoal; className?: string }) {
  return <span className={cn('size-2 shrink-0 rounded-full', GOAL_STYLES[goal].dotClass, className)} aria-hidden="true" />;
}
