import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getTrainingPlan } from '@/api/training-plans';
import TbdValue from '@/components/client-detail/TbdValue';
import type { ClientPlanItem } from '@/api/generated';
import type { RawTrainingPlanDetail, RawTrainingSession } from '@/api/training-plan-types';

interface Props {
  /** The client's active Training-type plan summary, or undefined if none. */
  plan?: ClientPlanItem;
  /** Whether the caller's link grants the training domain (ListClientPlansResponse.canViewTrainingPlans). */
  canView: boolean;
  /** Whether the plans-list query (which resolves `plan`/`canView`) is still loading. */
  isPending: boolean;
  isError: boolean;
}

/**
 * Resolves the "latest workout" session: there is no single "most recent
 * session" concept on the wire, so this mirrors how a coach reads the plan
 * — the session closest to "now", computed from the plan's Monday-anchored
 * `startDate` plus each day's (weekNumber, dayOfWeek) offset. Prefers the
 * most recently held session; falls back to the soonest upcoming one for a
 * plan that hasn't started yet (design review, #1094).
 */
function resolveMostRecentSession(plan: RawTrainingPlanDetail): RawTrainingSession | undefined {
  if (!plan.startDate) {
    return undefined;
  }
  const planStart = new Date(plan.startDate);
  const now = Date.now();

  let mostRecentPast: { session: RawTrainingSession; time: number } | undefined;
  let soonestFuture: { session: RawTrainingSession; time: number } | undefined;

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.sessions.length === 0) {
        continue;
      }
      const sessionDate = new Date(planStart);
      sessionDate.setDate(sessionDate.getDate() + (week.weekNumber - 1) * 7 + (day.dayOfWeek - 1));
      const time = sessionDate.getTime();

      for (const session of day.sessions) {
        if (time <= now) {
          if (!mostRecentPast || time > mostRecentPast.time) {
            mostRecentPast = { session, time };
          }
        } else if (!soonestFuture || time < soonestFuture.time) {
          soonestFuture = { session, time };
        }
      }
    }
  }

  return (mostRecentPast ?? soonestFuture)?.session;
}

/** "Latest workout" card (#1094). Exercise count is derived; estimated minutes is TBD — no duration field exists on any training document. */
export default function LatestWorkoutCard({ plan, canView, isPending, isError }: Props) {
  const { t } = useTranslation();

  const detailQuery = useQuery({
    queryKey: ['training-plan-detail', plan?.planId],
    queryFn: () => getTrainingPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const exerciseCount = detailQuery.data
    ? (resolveMostRecentSession(detailQuery.data)?.allExercises.length ?? undefined)
    : undefined;

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-body font-semibold text-ink">{t('clientDetail.overview.workout.heading')}</h2>

      {isPending && <Skeleton className="h-10 w-full" />}

      {!isPending && isError && <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>}

      {!isPending && !isError && (!canView || !plan) && (
        <p className="text-caption text-muted-foreground">{t('clientDetail.prehled.noActivePlan.training')}</p>
      )}

      {!isPending && !isError && canView && plan && (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Dumbbell className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body font-bold text-ink">{plan.name}</span>
            <span className="flex items-center gap-1 text-caption text-muted-foreground">
              {detailQuery.isPending ? (
                t('common.loading')
              ) : exerciseCount != null ? (
                <>
                  {t('clientDetail.overview.workout.exercises', { count: exerciseCount })}
                  {' • '}
                  <TbdValue />
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
