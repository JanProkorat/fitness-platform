import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { getClientPlans } from '@/api/client-plans';
import { getClientMeasurements } from '@/api/measurements';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import PanelIdentity from '@/components/inbox/panel/PanelIdentity';
import PanelStats from '@/components/inbox/panel/PanelStats';
import MealPlanPanelCard from '@/components/inbox/panel/MealPlanPanelCard';
import TrainingPanelCard from '@/components/inbox/panel/TrainingPanelCard';

const MEASUREMENTS_PAGE_SIZE = 50;

interface Props {
  clientPublicId: string;
  /** Leaves room for the sheet's close button when rendered inside the slide-in drawer. */
  inSheet?: boolean;
}

/**
 * The inbox's client panel: identity, weight / client-since cards, and the
 * active meal plan and training cards. Shares the `client-dashboard` /
 * `client-plans` / `client-measurements` query keys with `ClientDetailPage`
 * so both surfaces read one cache entry.
 */
export default function ClientSidePanel({ clientPublicId, inSheet = false }: Props) {
  const { t } = useTranslation();
  const containerClass = cn('flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 py-5.5', inSheet && 'pt-14');

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
      <div className={containerClass}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <p className="text-caption text-muted-foreground">{t('common.loadError')}</p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const plans = plansQuery.data?.plans;
  const activeNutritionPlan = plans?.find((p) => p.planType === 'Nutrition' && p.status === 'Active');
  const activeTrainingPlan = plans?.find((p) => p.planType === 'Training' && p.status === 'Active');

  return (
    <div className={containerClass}>
      <PanelIdentity dashboard={dashboard} />
      <PanelStats dashboard={dashboard} measurements={measurementsQuery.data?.items ?? []} />
      <MealPlanPanelCard
        clientPublicId={clientPublicId}
        plan={activeNutritionPlan}
        canView={plansQuery.data?.canViewNutritionPlans ?? false}
        isPending={plansQuery.isPending}
        isError={plansQuery.isError}
      />
      <TrainingPanelCard
        clientPublicId={clientPublicId}
        plan={activeTrainingPlan}
        canView={plansQuery.data?.canViewTrainingPlans ?? false}
        isPending={plansQuery.isPending}
        isError={plansQuery.isError}
      />
    </div>
  );
}
