import { Navigate, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { getClientPlans } from '@/api/client-plans';
import { getClientMeasurements } from '@/api/measurements';
import { resolveOverviewRole } from '@/lib/client-metrics';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ClientDetailHeader from '@/components/client-detail/ClientDetailHeader';
import ClientDetailTabs, { type ClientDetailTab } from '@/components/client-detail/ClientDetailTabs';
import ClientOverviewTab from '@/components/client-detail/ClientOverviewTab';
import ClientNutritionTab from '@/components/client-detail/nutrition/ClientNutritionTab';
import ClientPhotosTab from '@/components/client-detail/photos/ClientPhotosTab';

const MEASUREMENTS_PAGE_SIZE = 50;

/**
 * Client-detail page: header + URL-driven tab row. `/clients/:clientId` is the
 * Overview tab, `/clients/:clientId/nutrition` the Nutrition tab (a link
 * without the nutrition capability is redirected to Overview) and
 * `/clients/:clientId/photos` the Photos tab.
 */
export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNutritionRoute = useMatch('/clients/:clientId/nutrition') !== null;
  const isPhotosRoute = useMatch('/clients/:clientId/photos') !== null;
  const activeTab: ClientDetailTab = isNutritionRoute ? 'nutrition' : isPhotosRoute ? 'photos' : 'overview';

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

  // The layout follows the dashboard's capability flags: that query has resolved before first paint.
  const role = resolveOverviewRole(dashboard.canViewNutritionPlans, dashboard.canViewTrainingPlans);

  if (activeTab === 'nutrition' && role === 'trainer') {
    return <Navigate to={`/clients/${clientId}`} replace state={location.state} />;
  }

  function handleTabChange(tab: ClientDetailTab) {
    const suffix = tab === 'overview' ? '' : `/${tab}`;
    navigate(`/clients/${clientId}${suffix}`, { state: location.state });
  }

  return (
    <div className="flex flex-col gap-4">
      <ClientDetailHeader
        clientId={clientId}
        dashboard={dashboard}
        plansQuery={plansQuery}
        measurementsQuery={measurementsQuery}
        tabs={
          <ClientDetailTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            canViewNutritionPlans={role !== 'trainer'}
            canViewTrainingPlans={role !== 'nutritionist'}
          />
        }
      />

      {activeTab === 'nutrition' ? (
        <ClientNutritionTab clientId={clientId} dashboard={dashboard} />
      ) : activeTab === 'photos' ? (
        <ClientPhotosTab
          clientId={clientId}
          dashboard={dashboard}
          plans={plansQuery.data?.plans}
        />
      ) : (
        <ClientOverviewTab
          clientId={clientId}
          dashboard={dashboard}
          role={role}
          plansQuery={plansQuery}
          measurementsQuery={measurementsQuery}
        />
      )}
    </div>
  );
}
