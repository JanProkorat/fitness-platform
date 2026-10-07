import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
}

/**
 * Training card of the inbox client panel: latest workout (session name, exercise count, weekday).
 * The "done this week" progress bar is intentionally absent until the backend exposes a weekly session count.
 */
export default function TrainingPanelCard({ clientPublicId, plan, canView, isPending, isError }: Props) {
  const { t, i18n } = useTranslation();

  const detailQuery = useQuery({
    // Same key as the client-detail page's workout card, so both share one cache entry.
    queryKey: ['training-plan-detail', plan?.planId],
    queryFn: () => getTrainingPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const resolved = detailQuery.data ? resolveMostRecentSessionWithDay(detailQuery.data) : undefined;
  const showPlan = !isPending && !isError && canView && plan;

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
    </PlanCardShell>
  );
}
