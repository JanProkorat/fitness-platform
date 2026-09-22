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
import StatCard from '@/components/client-detail/StatCard';
import TbdValue from '@/components/client-detail/TbdValue';
import MealPlanCard from '@/components/client-detail/MealPlanCard';
import LatestWorkoutCard from '@/components/client-detail/LatestWorkoutCard';
import CheckInTrendCard from '@/components/client-detail/CheckInTrendCard';
import MessagesTrendCard from '@/components/client-detail/MessagesTrendCard';
import { formatClientDate } from '@/lib/date-format';
import type { MeasurementDto } from '@/api/generated';

const MEASUREMENTS_PAGE_SIZE = 50;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Nearest measurement at least 7 days older than the most recent one,
 * subtracted from it — not simply "the second most recent" (design
 * review, #1094). Returns undefined (never 0) when fewer than two
 * measurements exist, or none is old enough to compare against.
 */
function computeWeeklyWeightDelta(items: MeasurementDto[]): number | undefined {
  const withWeight = items
    .filter((m): m is MeasurementDto & { weightKg: number; measuredAt: string } => m.weightKg != null && m.measuredAt != null)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

  if (withWeight.length < 2) {
    return undefined;
  }

  const latest = withWeight[0];
  const latestTime = new Date(latest.measuredAt).getTime();
  const sevenDaysMs = 7 * MS_PER_DAY;

  let closest: (typeof withWeight)[number] | undefined;
  let closestOverflow = Number.POSITIVE_INFINITY;
  for (const measurement of withWeight.slice(1)) {
    const age = latestTime - new Date(measurement.measuredAt).getTime();
    if (age < sevenDaysMs) {
      continue;
    }
    const overflow = age - sevenDaysMs;
    if (overflow < closestOverflow) {
      closestOverflow = overflow;
      closest = measurement;
    }
  }

  if (!closest) {
    return undefined;
  }

  return Number((latest.weightKg - closest.weightKg).toFixed(1));
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY));
}

/**
 * Client-detail page — Overview tab (#1094). Header + seven-tab row (six
 * disabled) + four stat cards + two plan cards + two trend widgets. See
 * docs/design/1094/client-overview-inventory.md for the full layout
 * contract and docs/design/1094/client-overview-target.png for the
 * reference render.
 */
export default function ClientDetailPage() {
  const { t, i18n } = useTranslation();
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

  const weightDeltaKg = computeWeeklyWeightDelta(measurementsQuery.data?.items ?? []);
  const currentWeightKg = dashboard.latestMeasurement?.weightKg ?? dashboard.weightKg;
  const goalWeightKg = dashboard.onboarding?.targetWeightKg;

  const weightCaptionParts = [
    weightDeltaKg != null
      ? t('clientDetail.overview.stats.weight.deltaThisWeek', { delta: formatSignedNumber(weightDeltaKg) })
      : undefined,
    goalWeightKg != null ? t('clientDetail.overview.stats.weight.goalWeight', { goal: goalWeightKg }) : undefined,
  ].filter((segment): segment is string => Boolean(segment));

  const linkedDays = dashboard.linkedAt ? daysSince(dashboard.linkedAt) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <ClientDetailHeader dashboard={dashboard} />
      <ClientDetailTabs />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('clientDetail.overview.stats.rating.label')}
          value={<TbdValue />}
          caption={t('clientDetail.overview.stats.rating.caption')}
        />
        <StatCard
          label={t('clientDetail.overview.stats.payments.label')}
          value={<TbdValue />}
          caption={t('clientDetail.overview.stats.payments.caption')}
        />
        <StatCard
          label={t('clientDetail.overview.stats.weight.label')}
          value={
            currentWeightKg != null
              ? t('clientDetail.overview.stats.weight.value', { kg: currentWeightKg })
              : t('clientDetail.overview.stats.weight.empty')
          }
          caption={
            currentWeightKg == null
              ? t('clientDetail.overview.stats.weight.noMeasurements')
              : weightCaptionParts.length > 0
                ? weightCaptionParts.join(' • ')
                : undefined
          }
        />
        <StatCard
          label={t('clientDetail.overview.stats.clientSince.label')}
          value={linkedDays != null ? t('clientDetail.overview.stats.clientSince.days', { count: linkedDays }) : <TbdValue />}
          caption={
            dashboard.linkedAt
              ? t('clientDetail.overview.stats.clientSince.started', {
                  date: formatClientDate(dashboard.linkedAt, i18n.language, 'short'),
                })
              : undefined
          }
        />
      </div>

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
