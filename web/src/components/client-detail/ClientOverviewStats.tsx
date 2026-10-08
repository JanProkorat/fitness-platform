import { useTranslation } from 'react-i18next';
import StatCard from '@/components/client-detail/StatCard';
import TbdValue from '@/components/client-detail/TbdValue';
import { formatClientDate } from '@/lib/date-format';
import { computeWeeklyWeightDelta, daysSince, formatSignedNumber } from '@/lib/client-metrics';
import type { GetClientDashboardResponse, MeasurementDto } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  measurements: MeasurementDto[];
}

/**
 * The four equal-width stat cards (average rating, payments, current
 * weight, client since) on the client-detail Overview tab.
 */
export default function ClientOverviewStats({ dashboard, measurements }: Props) {
  const { t, i18n } = useTranslation();

  const weightDeltaKg = computeWeeklyWeightDelta(measurements);
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
  );
}
