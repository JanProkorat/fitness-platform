import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { getClientPlans } from '@/api/client-plans';
import { getClientMeasurements } from '@/api/measurements';
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
 * Client-detail page — Overview tab. Header + seven-tab row (six disabled) +
 * three stat cards + two plan cards + check-in trend and weight + recent
 * activity and client profile (boards PageClientDetailC / PageClientDetailD).
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

  return (
    <div className="flex flex-col gap-4">
      <ClientDetailHeader dashboard={dashboard} />
      <ClientDetailTabs />

      <ClientOverviewStats dashboard={dashboard} clientId={clientId} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MealPlanCard
            plan={activeNutritionPlan}
            canView={canViewNutritionPlans}
            isPending={plansQuery.isPending}
            isError={plansQuery.isError}
          />
        </div>
        <div className="lg:col-span-2">
          <LatestWorkoutCard
            plan={activeTrainingPlan}
            canView={canViewTrainingPlans}
            isPending={plansQuery.isPending}
            isError={plansQuery.isError}
            noTrainingAccess={dashboard.canViewTrainingPlans === false}
          />
        </div>
      </div>

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
        <RecentActivityCard clientId={clientId} />
        <ClientProfileCard onboarding={dashboard.onboarding} />
      </div>
    </div>
  );
}
