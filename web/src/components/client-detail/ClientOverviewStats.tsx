import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/client-detail/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientVerdict } from '@/api/client-verdict';
import { formatClientDate } from '@/lib/date-format';
import { daysSince, formatRelativeTime } from '@/lib/client-metrics';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  /** Route client id (PublicId), as the verdict endpoint expects. */
  clientId: string;
}

const EMPTY_VALUE = '—';

/**
 * The three equal-width stat cards on the client-detail Overview tab: meal
 * compliance, PRs this month and client since.
 */
export default function ClientOverviewStats({ dashboard, clientId }: Props) {
  const { t, i18n } = useTranslation();

  const verdictQuery = useQuery({
    queryKey: ['client-verdict', clientId],
    queryFn: () => getClientVerdict(clientId),
    enabled: Boolean(clientId),
    retry: false,
  });

  const noTrainingAccess = dashboard.canViewTrainingPlans === false;
  const noNutritionAccess = dashboard.canViewNutritionPlans === false;
  const compliancePercent = dashboard.compliancePercent;
  const streak = dashboard.currentStreak ?? 0;

  let complianceCaption: string;
  if (compliancePercent == null) {
    complianceCaption = noNutritionAccess
      ? t('clientDetail.overview.stats.mealCompliance.noAccess')
      : t('clientDetail.overview.stats.mealCompliance.empty');
  } else if (streak > 0) {
    complianceCaption = t('clientDetail.overview.stats.mealCompliance.captionStreak', { count: streak });
  } else {
    complianceCaption = t('clientDetail.overview.stats.mealCompliance.caption');
  }

  const prCount = verdictQuery.data?.prCountThisMonth;
  const lastActiveAt = verdictQuery.data?.lastActiveAt;

  let prValue: string | number = EMPTY_VALUE;
  let prCaption: string | undefined;
  if (noTrainingAccess) {
    prCaption = t('clientDetail.overview.stats.prs.noAccess');
  } else if (verdictQuery.isPending) {
    prCaption = undefined;
  } else if (verdictQuery.isError) {
    prCaption = t('common.loadError');
  } else {
    if (prCount != null) {
      prValue = prCount;
    }
    prCaption = lastActiveAt
      ? t('clientDetail.overview.stats.prs.lastActive', { when: formatRelativeTime(lastActiveAt, i18n.language) })
      : t('clientDetail.overview.stats.prs.noActivity');
  }

  const linkedDays = dashboard.linkedAt ? daysSince(dashboard.linkedAt) : undefined;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <StatCard
        label={t('clientDetail.overview.stats.mealCompliance.label')}
        value={
          compliancePercent != null
            ? t('clientDetail.overview.stats.mealCompliance.value', { percent: Math.round(compliancePercent) })
            : EMPTY_VALUE
        }
        caption={complianceCaption}
      />
      <StatCard
        label={t('clientDetail.overview.stats.prs.label')}
        value={!noTrainingAccess && verdictQuery.isPending ? <Skeleton className="h-8 w-12" /> : prValue}
        caption={prCaption}
      />
      <StatCard
        label={t('clientDetail.overview.stats.clientSince.label')}
        value={linkedDays != null ? t('clientDetail.overview.stats.clientSince.days', { count: linkedDays }) : EMPTY_VALUE}
        caption={
          dashboard.linkedAt
            ? t('clientDetail.overview.stats.clientSince.started', {
                date: formatClientDate(dashboard.linkedAt, i18n.language, 'short'),
              })
            : undefined
        }
      />
    </div>
  );
}
