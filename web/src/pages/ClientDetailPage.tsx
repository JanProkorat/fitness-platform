import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { getClientPlans } from '@/api/client-plans';
import { getClientMeasurements } from '@/api/measurements';
import { resolveOverviewRole } from '@/lib/client-metrics';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ClientDetailHeader from '@/components/client-detail/ClientDetailHeader';
import ClientDetailTabs from '@/components/client-detail/ClientDetailTabs';
import ClientOverviewStats from '@/components/client-detail/ClientOverviewStats';
import MealPlanCard from '@/components/client-detail/MealPlanCard';
import LatestWorkoutCard from '@/components/client-detail/LatestWorkoutCard';
import CheckInTrendCard from '@/components/client-detail/CheckInTrendCard';
import WeightCard from '@/components/client-detail/WeightCard';
import RecentActivityCard from '@/components/client-detail/RecentActivityCard';
import ClientProfileCard from '@/components/client-detail/ClientProfileCard';

const MEASUREMENTS_PAGE_SIZE = 50;

/**
 * Client-detail page — Overview tab. Header + tab row (all but Overview
 * disabled) + three stat cards + plan card(s) + check-in trend and weight +
 * recent activity and client profile. A link with both capabilities gets the
 * two-card layout (PageClientDetailC / D); a trainer-only or nutritionist-only
 * link gets its own domain's card at full width (PageClientDetailTrainerC / D,
 * PageClientDetailNutritionistC / D).
 */
export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { clientId = '' } = useParams<{ clientId: string }>();

  const dashboardQuery = useQuery({
    queryKey: ['client-dashboard', clientId],
    queryFn: () => apiClient.getClientDashboardEndpoint(clientId),
    enabled: Boolean(clientId),
  });

  const plansQuery = useQuery({
    queryKey: ['client-plans', clientId],
    queryFn: () => getClientPlans(clientId),
    enabled: Boolean(clientId),
  });

  const measurementsQuery = useQuery({
    queryKey: ['client-measurements', clientId],
    queryFn: () => getClientMeasurements(clientId, 1, MEASUREMENTS_PAGE_SIZE),
    enabled: Boolean(clientId),
  });

  if (dashboardQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void dashboardQuery.refetch()}>
          {t('clients.retry')}
        </Button>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const canViewNutritionPlans = plansQuery.data?.canViewNutritionPlans ?? false;
  const canViewTrainingPlans = plansQuery.data?.canViewTrainingPlans ?? false;
  const activeNutritionPlan = plansQuery.data?.plans?.find((p) => p.planType === 'Nutrition' && p.status === 'Active');
  const activeTrainingPlan = plansQuery.data?.plans?.find((p) => p.planType === 'Training' && p.status === 'Active');

  // The layout follows the dashboard's capability flags: that query has resolved before first paint.
  const role = resolveOverviewRole(dashboard.canViewNutritionPlans, dashboard.canViewTrainingPlans);

  const mealPlanCard = (
    <MealPlanCard
      plan={activeNutritionPlan}
      canView={canViewNutritionPlans}
      isPending={plansQuery.isPending}
      isError={plansQuery.isError}
    />
  );
  const workoutCard = (
    <LatestWorkoutCard
      plan={activeTrainingPlan}
      canView={canViewTrainingPlans}
      isPending={plansQuery.isPending}
      isError={plansQuery.isError}
      sessionsCompleted={dashboard.sessionsCompletedThisWeek}
      sessionsPlanned={dashboard.sessionsPlannedThisWeek}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <ClientDetailHeader dashboard={dashboard} />
      <ClientDetailTabs
        canViewNutritionPlans={role !== 'trainer'}
        canViewTrainingPlans={role !== 'nutritionist'}
      />

      <ClientOverviewStats
        dashboard={dashboard}
        clientId={clientId}
        role={role}
        measurements={measurementsQuery.data?.items ?? []}
        measurementsPending={measurementsQuery.isPending}
        measurementsError={measurementsQuery.isError}
      />

      {role === 'both' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-3">{mealPlanCard}</div>
          <div className="lg:col-span-2">{workoutCard}</div>
        </div>
      ) : (
        <div>{role === 'nutritionist' ? mealPlanCard : workoutCard}</div>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CheckInTrendCard clientUserId={dashboard.clientUserId ?? ''} />
        </div>
        <div className="lg:col-span-2">
          <WeightCard
            dashboard={dashboard}
            measurements={measurementsQuery.data?.items ?? []}
            isPending={measurementsQuery.isPending}
            isError={measurementsQuery.isError}
            onRetry={() => void measurementsQuery.refetch()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <RecentActivityCard clientId={clientId} role={role} />
        <ClientProfileCard onboarding={dashboard.onboarding} role={role} />
      </div>
    </div>
  );
}
