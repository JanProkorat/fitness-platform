import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getClientPlans } from '@/api/client-plans';
import { getClientMeasurements } from '@/api/measurements';
import { Skeleton } from '@/components/ui/skeleton';
import ClientIdentityBlock from '@/components/client-detail/ClientIdentityBlock';
import ClientOverviewStats from '@/components/client-detail/ClientOverviewStats';
import MealPlanCard from '@/components/client-detail/MealPlanCard';
import LatestWorkoutCard from '@/components/client-detail/LatestWorkoutCard';
import CheckInTrendCard from '@/components/client-detail/CheckInTrendCard';
import MessagesTrendCard from '@/components/client-detail/MessagesTrendCard';

const MEASUREMENTS_PAGE_SIZE = 50;

interface Props {
  clientPublicId: string;
}

/**
 * The inbox's "Show client" panel (~300px, hidden by default). Reuses the
 * #1094 client-overview card set verbatim, laid out narrower — same query
 * keys as `ClientDetailPage` (`client-dashboard`/`client-plans`/
 * `client-measurements`) so both surfaces share one cache entry rather than
 * fetching twice.
 */
export default function ClientSidePanel({ clientPublicId }: Props) {
  const { t } = useTranslation();

  const dashboardQuery = useQuery({
    queryKey: ['client-dashboard', clientPublicId],
    queryFn: () => apiClient.getClientDashboardEndpoint(clientPublicId),
    enabled: Boolean(clientPublicId),
  });

  const plansQuery = useQuery({
    queryKey: ['client-plans', clientPublicId],
    queryFn: () => getClientPlans(clientPublicId),
    enabled: Boolean(clientPublicId),
  });

  const measurementsQuery = useQuery({
    queryKey: ['client-measurements', clientPublicId],
    queryFn: () => getClientMeasurements(clientPublicId, 1, MEASUREMENTS_PAGE_SIZE),
    enabled: Boolean(clientPublicId),
  });

  if (dashboardQuery.isPending) {
    return (
      <div className="flex h-full w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex h-full w-[300px] shrink-0 items-center justify-center border-l border-border p-4">
        <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const canViewNutritionPlans = plansQuery.data?.canViewNutritionPlans ?? false;
  const canViewTrainingPlans = plansQuery.data?.canViewTrainingPlans ?? false;
  const activeNutritionPlan = plansQuery.data?.plans?.find((p) => p.planType === 'Nutrition' && p.status === 'Active');
  const activeTrainingPlan = plansQuery.data?.plans?.find((p) => p.planType === 'Training' && p.status === 'Active');

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-4">
      <ClientIdentityBlock dashboard={dashboard} headingLevel="h2" />

      <ClientOverviewStats dashboard={dashboard} measurements={measurementsQuery.data?.items ?? []} columns={2} />

      <MealPlanCard
        plan={activeNutritionPlan}
        canView={canViewNutritionPlans}
        isPending={plansQuery.isPending}
        isError={plansQuery.isError}
      />
      <LatestWorkoutCard
        plan={activeTrainingPlan}
        canView={canViewTrainingPlans}
        isPending={plansQuery.isPending}
        isError={plansQuery.isError}
      />
      <CheckInTrendCard />
      <MessagesTrendCard clientId={clientPublicId} />
    </div>
  );
}
