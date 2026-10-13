import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/client-detail/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientVerdict } from '@/api/client-verdict';
import { formatClientDate } from '@/lib/date-format';
import {
  computeWeightChange,
  daysSince,
  formatRelativeTime,
  formatSignedNumber,
  type ClientOverviewRole,
} from '@/lib/client-metrics';
import type { GetClientDashboardResponse, MeasurementDto } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  /** Route client id (PublicId), as the verdict endpoint expects. */
  clientId: string;
  /** Layout the coach's link grants (see resolveOverviewRole). */
  role: ClientOverviewRole;
  /** Client measurements, for the nutritionist's weight-change tile. */
  measurements: MeasurementDto[];
  measurementsPending: boolean;
  measurementsError: boolean;
}

const EMPTY_VALUE = '—';
/** Number of latest weighed measurements the weight-change tile spans; matches the Weight card chart. */
const WEIGHT_CHANGE_WINDOW = 8;

/**
 * The three equal-width stat cards on the client-detail Overview tab. The first
 * and second tiles follow the coach's role: meal compliance + PRs (both),
 * training compliance + PRs (trainer) or meal compliance + weight change
 * (nutritionist). Client since is always last.
 */
export default function ClientOverviewStats({
  dashboard,
  clientId,
  role,
  measurements,
  measurementsPending,
  measurementsError,
}: Props) {
  const { t, i18n } = useTranslation();

  const showPrs = role !== 'nutritionist';
  const showWeightChange = role === 'nutritionist';
  const complianceKey = role === 'trainer' ? 'trainingCompliance' : 'mealCompliance';

  const verdictQuery = useQuery({
    queryKey: ['client-verdict', clientId],
    queryFn: () => getClientVerdict(clientId),
    enabled: Boolean(clientId) && showPrs,
    retry: false,
  });

  // Per-discipline figures: undefined when the link lacks that capability.
  const compliancePercent =
    role === 'trainer' ? dashboard.trainingCompliancePercent : dashboard.nutritionCompliancePercent;
  const streak = (role === 'trainer' ? dashboard.trainingStreak : dashboard.nutritionStreak) ?? 0;

  let complianceCaption: string;
  if (compliancePercent == null) {
    complianceCaption = t(`clientDetail.overview.stats.${complianceKey}.empty`);
  } else if (streak > 0) {
    complianceCaption = t(`clientDetail.overview.stats.${complianceKey}.captionStreak`, { count: streak });
  } else {
    complianceCaption = t(`clientDetail.overview.stats.${complianceKey}.caption`);
  }

  const complianceTile = (
    <StatCard
      label={t(`clientDetail.overview.stats.${complianceKey}.label`)}
      value={
        compliancePercent != null
          ? t(`clientDetail.overview.stats.${complianceKey}.value`, { percent: Math.round(compliancePercent) })
          : EMPTY_VALUE
      }
      caption={complianceCaption}
    />
  );

  const prCount = verdictQuery.data?.prCountThisMonth;
  const lastActiveAt = verdictQuery.data?.lastActiveAt;

  let prValue: string | number = EMPTY_VALUE;
  let prCaption: string | undefined;
  if (verdictQuery.isPending) {
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

  const weightChange = computeWeightChange(measurements, WEIGHT_CHANGE_WINDOW);
  const targetWeightKg = dashboard.onboarding?.targetWeightKg;
  const formatNumber = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  let weightValue: ReactNode = EMPTY_VALUE;
  let weightCaption: string | undefined;
  if (measurementsPending) {
    weightValue = <Skeleton className="h-8 w-16" />;
  } else if (measurementsError) {
    weightCaption = t('common.loadError');
  } else if (weightChange) {
    weightValue = t('clientDetail.overview.stats.weightChange.value', {
      delta: formatSignedNumber(weightChange.deltaKg),
    });
    const since = t('clientDetail.overview.stats.weightChange.since', {
      date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(
        new Date(weightChange.sinceIso),
      ),
    });
    weightCaption =
      targetWeightKg != null
        ? t('clientDetail.overview.stats.weightChange.sinceGoal', {
            since,
            goal: formatNumber(targetWeightKg),
          })
        : since;
  } else {
    weightCaption = t('clientDetail.overview.stats.weightChange.empty');
  }

  const linkedDays = dashboard.linkedAt ? daysSince(dashboard.linkedAt) : undefined;

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      {complianceTile}
      {showPrs && (
        <StatCard
          label={t('clientDetail.overview.stats.prs.label')}
          value={verdictQuery.isPending ? <Skeleton className="h-8 w-12" /> : prValue}
          caption={prCaption}
        />
      )}
      {showWeightChange && (
        <StatCard
          label={t('clientDetail.overview.stats.weightChange.label')}
          value={weightValue}
          caption={weightCaption}
        />
      )}
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
