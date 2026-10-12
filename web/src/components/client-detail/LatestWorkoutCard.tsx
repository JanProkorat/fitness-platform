import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import PlanCardHeader from '@/components/client-detail/PlanCardHeader';
import { getTrainingPlan } from '@/api/training-plans';
import { resolveMostRecentSessionWithDay, weekdayName } from '@/lib/client-metrics';
import type { ClientPlanItem } from '@/api/generated';

interface Props {
  /** The client's active Training-type plan summary, or undefined if none. */
  plan?: ClientPlanItem;
  /** Whether the caller's link grants the training domain (ListClientPlansResponse.canViewTrainingPlans). */
  canView: boolean;
  /** Whether the plans-list query (which resolves `plan`/`canView`) is still loading. */
  isPending: boolean;
  isError: boolean;
  /** True for a nutritionist-only link (dashboard.canViewTrainingPlans === false). */
  noTrainingAccess?: boolean;
  /** Sessions held this week, from the client dashboard (null when no current week). */
  sessionsCompleted?: number | null;
  sessionsPlanned?: number | null;
}

/**
 * "Latest workout" card. Exercise count and weekday come from the same
 * resolved session of the plan; the weekly progress bar comes from the
 * dashboard's this-week counters.
 */
export default function LatestWorkoutCard({
  plan,
  canView,
  isPending,
  isError,
  noTrainingAccess = false,
  sessionsCompleted,
  sessionsPlanned,
}: Props) {
  const { t, i18n } = useTranslation();

  const detailQuery = useQuery({
    queryKey: ['training-plan-detail', plan?.planId],
    queryFn: () => getTrainingPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const resolved = detailQuery.data ? resolveMostRecentSessionWithDay(detailQuery.data) : undefined;
  const exerciseCount = resolved?.session.allExercises.length;
  const dayLabel = resolved ? weekdayName(resolved.dayOfWeek, i18n.language) : undefined;

  const showBar = sessionsPlanned != null && sessionsPlanned > 0;
  const doneCount = Math.min(Math.max(sessionsCompleted ?? 0, 0), sessionsPlanned ?? 0);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <PlanCardHeader
        tone="training"
        label={t('clientDetail.overview.workout.label')}
        heading={t('clientDetail.overview.workout.heading')}
      />

      {noTrainingAccess && (
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-bold text-ink">—</span>
          <span className="text-caption text-muted-foreground">{t('clientDetail.overview.workout.noAccess')}</span>
        </div>
      )}

      {!noTrainingAccess && isPending && <Skeleton className="h-10 w-full" />}

      {!noTrainingAccess && !isPending && isError && (
        <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>
      )}

      {!noTrainingAccess && !isPending && !isError && (!canView || !plan) && (
        <p className="text-caption text-muted-foreground">{t('clientDetail.prehled.noActivePlan.training')}</p>
      )}

      {!noTrainingAccess && !isPending && !isError && canView && plan && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-training-soft">
              <Dumbbell className="size-5 text-training-ink" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-bold text-ink">{plan.name}</span>
              <span className="text-caption text-muted-foreground">
                {detailQuery.isError
                  ? t('common.loadError')
                  : detailQuery.isPending
                    ? t('common.loading')
                    : exerciseCount != null
                      ? [t('clientDetail.overview.workout.cardExercises', { count: exerciseCount }), dayLabel]
                          .filter(Boolean)
                          .join(' • ')
                      : '—'}
              </span>
            </div>
          </div>

          {showBar && (
            <div className="flex flex-col gap-1.5">
              <div className="flex h-1 gap-1" aria-hidden="true">
                {Array.from({ length: sessionsPlanned }, (_, index) => (
                  <div
                    key={index}
                    className={cn('flex-1 rounded-full', index < doneCount ? 'bg-training' : 'bg-border')}
                  />
                ))}
              </div>
              <span className="text-caption text-muted-foreground">
                {t('clientDetail.overview.workout.doneThisWeek', { done: doneCount, total: sessionsPlanned })}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
