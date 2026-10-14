import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientPlans } from '@/api/client-plans';
import { getPlan } from '@/api/plans';
import type { GetClientDashboardResponse } from '@/api/generated';
import CurrentPlanCard from '@/components/client-detail/nutrition/CurrentPlanCard';
import IsItWorkingCard from '@/components/client-detail/nutrition/IsItWorkingCard';
import MealPhotosNotesCard from '@/components/client-detail/nutrition/MealPhotosNotesCard';
import NutritionEmptyState from '@/components/client-detail/nutrition/NutritionEmptyState';
import NutritionProfileCard from '@/components/client-detail/nutrition/NutritionProfileCard';
import PastPlansCard from '@/components/client-detail/nutrition/PastPlansCard';
import PlanTimelineCard from '@/components/client-detail/nutrition/PlanTimelineCard';
import ThisWeekCard from '@/components/client-detail/nutrition/ThisWeekCard';
import {
  selectCurrentPlan,
  selectOpenPlans,
  selectPastPlans,
  type PlanDetailState,
} from '@/components/client-detail/nutrition/nutritionPlanView';

interface Props {
  clientId: string;
  dashboard: GetClientDashboardResponse;
}

/**
 * Nutrition tab of the client detail page: the current plan, the plan
 * timeline and past plans, or the empty state when the client has neither an
 * Active plan nor a Draft. Cards for the week, progress, photos and nutrition
 * profile are added to the marked slots later.
 */
export default function ClientNutritionTab({ clientId, dashboard }: Props) {
  const { t } = useTranslation();
  const firstName = dashboard.firstName ?? '';

  const plansQuery = useQuery({
    queryKey: ['client-plans', clientId],
    queryFn: () => getClientPlans(clientId),
    enabled: Boolean(clientId),
  });

  const plans = plansQuery.data?.plans;
  const openPlans = useMemo(() => selectOpenPlans(plans), [plans]);
  const currentPlan = useMemo(() => selectCurrentPlan(plans), [plans]);
  const pastPlans = useMemo(() => selectPastPlans(plans), [plans]);

  const detailQueries = useQueries({
    queries: openPlans.map((plan) => ({
      queryKey: ['nutrition-plan-detail', plan.planId],
      queryFn: () => getPlan(plan.planId ?? ''),
      enabled: Boolean(plan.planId),
    })),
  });

  const details: Record<string, PlanDetailState> = {};
  openPlans.forEach((plan, index) => {
    const query = detailQueries[index];
    if (plan.planId && query) {
      details[plan.planId] = { plan: query.data, isPending: query.isPending, isError: query.isError };
    }
  });

  if (plansQuery.isPending) {
    return (
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (plansQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void plansQuery.refetch()}>
          {t('clients.retry')}
        </Button>
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
        <NutritionEmptyState clientId={clientId} dashboard={dashboard} />
        <div className="flex flex-col gap-3.5">
          <NutritionProfileCard clientId={clientId} clientFirstName={firstName} onboarding={dashboard.onboarding} />
          <PastPlansCard clientId={clientId} clientFirstName={firstName} plans={pastPlans} />
        </div>
      </div>
    );
  }

  const currentDetail: PlanDetailState = (currentPlan.planId ? details[currentPlan.planId] : undefined) ?? {
    isPending: true,
    isError: false,
  };
  const retryCurrent = () => {
    const index = openPlans.findIndex((p) => p.planId === currentPlan.planId);
    if (index >= 0) {
      void detailQueries[index].refetch();
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <CurrentPlanCard clientId={clientId} plan={currentPlan} detail={currentDetail} onRetry={retryCurrent} />
      <PlanTimelineCard clientId={clientId} plans={plans ?? []} details={details} />
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ThisWeekCard detail={currentDetail} onRetry={retryCurrent} />
        </div>
        <div className="xl:col-span-2">
          <IsItWorkingCard clientId={clientId} plans={plans} targetWeightKg={dashboard.onboarding?.targetWeightKg} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-10">
        <div className="xl:col-span-4">
          <PastPlansCard clientId={clientId} clientFirstName={firstName} plans={pastPlans} />
        </div>
        <div className="xl:col-span-3">
          <MealPhotosNotesCard clientId={clientId} clientUserId={dashboard.clientUserId} />
        </div>
        <div className="xl:col-span-3 xl:col-start-8">
          <NutritionProfileCard clientId={clientId} clientFirstName={firstName} onboarding={dashboard.onboarding} />
        </div>
      </div>
    </div>
  );
}
