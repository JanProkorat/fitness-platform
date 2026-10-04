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
import MessagesTrendCard from '@/components/client-detail/MessagesTrendCard';

const MEASUREMENTS_PAGE_SIZE = 50;

/**
 * Client-detail page — Overview tab (#1094). Header + seven-tab row (six
 * disabled) + four stat cards + two plan cards + two trend widgets. See
 * docs/design/1094/client-overview-inventory.md for the full layout
 * contract and docs/design/1094/client-overview-target.png for the
 * reference render.
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

      <ClientOverviewStats dashboard={dashboard} measurements={measurementsQuery.data?.items ?? []} />

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
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CheckInTrendCard />
        </div>
        <div className="lg:col-span-2">
          <MessagesTrendCard clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
