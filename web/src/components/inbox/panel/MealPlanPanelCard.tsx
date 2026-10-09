import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Utensils } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlan } from '@/api/plans';
import { computeMacroShares } from '@/lib/client-metrics';
import PlanCardShell, { PlanCardSummary } from '@/components/inbox/panel/PlanCardShell';
import type { ClientPlanItem } from '@/api/generated';

interface Props {
  clientPublicId: string;
  plan?: ClientPlanItem;
  canView: boolean;
  isPending: boolean;
  isError: boolean;
}

/** Meal-plan card of the inbox client panel: plan name, kcal + macro split, and the macro bar. */
export default function MealPlanPanelCard({ clientPublicId, plan, canView, isPending, isError }: Props) {
  const { t, i18n } = useTranslation();

  const detailQuery = useQuery({
    // Same key as the client-detail page's meal-plan card, so both share one cache entry.
    queryKey: ['nutrition-plan-detail', plan?.planId],
    queryFn: () => getPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const settings = detailQuery.data?.globalSettings;
  const shares = computeMacroShares(settings?.dailyKcal, settings?.proteinGrams, settings?.carbsGrams, settings?.fatGrams);

  const showPlan = !isPending && !isError && canView && plan;

  return (
    <PlanCardShell
      kind="nutrition"
      eyebrow={t('inbox.panel.mealPlan.eyebrow')}
      caption={t('clientDetail.overview.mealPlan.heading')}
      openTo={showPlan ? `/clients/${clientPublicId}` : undefined}
    >
      {isPending && <Skeleton className="h-11 w-full" />}

      {!isPending && isError && <p className="text-meta text-muted-foreground">{t('common.loadError')}</p>}

      {!isPending && !isError && (!canView || !plan) && (
        <p className="text-meta text-muted-foreground">{t('clientDetail.prehled.noActivePlan.nutrition')}</p>
      )}

      {showPlan && (
        <>
          <PlanCardSummary
            kind="nutrition"
            icon={<Utensils className="size-6" aria-hidden="true" />}
            title={plan.name ?? ''}
            subtitle={
              detailQuery.isError
                ? t('common.loadError')
                : detailQuery.isPending
                  ? t('common.loading')
                  : shares
                    ? t('inbox.panel.mealPlan.detail', {
                        kcal: (settings?.dailyKcal ?? 0).toLocaleString(i18n.language),
                        protein: shares.proteinPct,
                        carbs: shares.carbPct,
                        fat: shares.fatPct,
                      })
                    : '—'
            }
          />
          {shares && (
            <div className="flex flex-col gap-1.5">
              <div className="flex h-1.25 gap-0.5">
                <span className="rounded-xs bg-macro-protein" style={{ flexGrow: shares.proteinPct }} />
                <span className="rounded-xs bg-macro-carbs" style={{ flexGrow: shares.carbPct }} />
                <span className="rounded-xs bg-macro-fat" style={{ flexGrow: shares.fatPct }} />
              </div>
              <span className="text-caption text-muted-foreground">{t('inbox.panel.mealPlan.macrosLegend')}</span>
            </div>
          )}
        </>
      )}
    </PlanCardShell>
  );
}
