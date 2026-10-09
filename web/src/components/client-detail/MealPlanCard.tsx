import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Utensils } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlan } from '@/api/plans';
import { computeMacroShares } from '@/lib/client-metrics';
import type { ClientPlanItem } from '@/api/generated';

interface Props {
  /** The client's active Nutrition-type plan summary, or undefined if none. */
  plan?: ClientPlanItem;
  /** Whether the caller's link grants the nutrition domain (ListClientPlansResponse.canViewNutritionPlans). */
  canView: boolean;
  /** Whether the plans-list query (which resolves `plan`/`canView`) is still loading. */
  isPending: boolean;
  isError: boolean;
}

/**
 * "Current meal plan" card (#1094). Kcal and the macro split aren't on the
 * plans-list response, so a second fetch loads the full plan for
 * `globalSettings` once we know which plan is active.
 */
export default function MealPlanCard({ plan, canView, isPending, isError }: Props) {
  const { t } = useTranslation();

  const detailQuery = useQuery({
    queryKey: ['nutrition-plan-detail', plan?.planId],
    queryFn: () => getPlan(plan!.planId!),
    enabled: canView && Boolean(plan?.planId),
  });

  const globalSettings = detailQuery.data?.globalSettings;
  const dailyKcal = globalSettings?.dailyKcal;
  const proteinGrams = globalSettings?.proteinGrams;
  const carbsGrams = globalSettings?.carbsGrams;
  const fatGrams = globalSettings?.fatGrams;

  let macroDetail: string | undefined;
  const shares = computeMacroShares(dailyKcal, proteinGrams, carbsGrams, fatGrams);
  if (shares) {
    macroDetail = t('clientDetail.overview.mealPlan.detail', {
      kcal: dailyKcal,
      carb: shares.carbPct,
      protein: shares.proteinPct,
      fat: shares.fatPct,
    });
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-body font-semibold text-ink">{t('clientDetail.overview.mealPlan.heading')}</h2>

      {isPending && <Skeleton className="h-10 w-full" />}

      {!isPending && isError && <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>}

      {!isPending && !isError && (!canView || !plan) && (
        <p className="text-caption text-muted-foreground">{t('clientDetail.prehled.noActivePlan.nutrition')}</p>
      )}

      {!isPending && !isError && canView && plan && (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Utensils className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body font-bold text-ink">{plan.name}</span>
            <span className="text-caption text-muted-foreground">
              {detailQuery.isError
                ? t('common.loadError')
                : detailQuery.isPending
                  ? t('common.loading')
                  : (macroDetail ?? '—')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
