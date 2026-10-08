import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getTrainingPlan } from '@/api/training-plans';
import { resolveMostRecentSessionWithDay } from '@/lib/client-metrics';
import PlanCardShell, { PlanCardSummary } from '@/components/inbox/panel/PlanCardShell';
import type { ClientPlanItem } from '@/api/generated';

/** 2024-01-01 is a Monday, so day-of-week N (1 = Monday) maps to January N. */
function weekdayLabel(dayOfWeek: number, locale: string): string {
  return new Date(2024, 0, dayOfWeek).toLocaleDateString(locale, { weekday: 'long' });
}

interface Props {
  clientPublicId: string;
  plan?: ClientPlanItem;
  canView: boolean;
  isPending: boolean;
  isError: boolean;
  /** Sessions done / planned this week, from the client dashboard. */
  sessionsCompleted?: number;
  sessionsPlanned?: number;
}

/** Training card of the inbox client panel: latest workout (session name, exercise count, weekday) and this week's progress. */
export default function TrainingPanelCard({
  clientPublicId,
  plan,
  canView,
  isPending,
  isError,
  sessionsCompleted,
  sessionsPlanned,
}: Props) {
  const { t, i18n } = useTranslation();

  const detailQuery = useQuery({
    // Same key as the client-detail page's workout card, so both share one cache entry.
    queryKey: ['training-plan-detail', plan?.planId],
    queryFn: () => getTrainingPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const resolved = detailQuery.data ? resolveMostRecentSessionWithDay(detailQuery.data) : undefined;
  const showPlan = !isPending && !isError && canView && plan;
  const showWeek =
    Boolean(showPlan) && sessionsCompleted != null && sessionsPlanned != null && sessionsPlanned > 0;
  const planned = sessionsPlanned ?? 0;
  const done = Math.min(sessionsCompleted ?? 0, planned);

  return (
    <PlanCardShell
      kind="training"
      eyebrow={t('inbox.panel.training.eyebrow')}
      caption={t('clientDetail.overview.workout.heading')}
      openTo={showPlan ? `/clients/${clientPublicId}` : undefined}
    >
      {isPending && <Skeleton className="h-11 w-full" />}

      {!isPending && isError && <p className="text-meta text-muted-foreground">{t('common.loadError')}</p>}

      {!isPending && !isError && (!canView || !plan) && (
        <p className="text-meta text-muted-foreground">{t('clientDetail.prehled.noActivePlan.training')}</p>
      )}

      {showPlan && (
        <PlanCardSummary
          kind="training"
          icon={<Dumbbell className="size-6" aria-hidden="true" />}
          title={resolved?.session.name || plan.name || ''}
          subtitle={
            detailQuery.isError
              ? t('common.loadError')
              : detailQuery.isPending
                ? t('common.loading')
                : resolved
                  ? `${t('inbox.panel.training.exercises', { count: resolved.session.allExercises.length })} • ${weekdayLabel(resolved.dayOfWeek, i18n.language)}`
                  : '—'
          }
        />
      )}

      {showWeek && (
        <div className="flex flex-col gap-1.5">
          <div aria-hidden="true" className="flex gap-1">
            {Array.from({ length: planned }, (_, index) => (
              <span
                key={index}
                className={cn('h-1.25 flex-1 rounded-full', index < done ? 'bg-training' : 'bg-line')}
              />
            ))}
          </div>
          <p className="text-meta text-muted-foreground">
            {t('inbox.panel.training.doneThisWeek', { count: planned, done })}
          </p>
        </div>
      )}
    </PlanCardShell>
  );
}
