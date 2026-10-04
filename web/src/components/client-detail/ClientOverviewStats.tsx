import { useTranslation } from 'react-i18next';
import StatCard from '@/components/client-detail/StatCard';
import TbdValue from '@/components/client-detail/TbdValue';
import { formatClientDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import type { GetClientDashboardResponse, MeasurementDto } from '@/api/generated';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Props {
  dashboard: GetClientDashboardResponse;
  measurements: MeasurementDto[];
  /**
   * Grid column count — 4 on the client-detail Overview tab (#1094), 2 in
   * the inbox's narrower "Show client" side panel (#1095), which has no
   * room for a four-across row. Same cards, same derivations, laid out
   * narrower — no second implementation (design inventory, #1095).
   */
  columns?: 2 | 4;
}

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
 * The four equal-width stat cards (average rating, payments, current
 * weight, client since) shared by the client-detail Overview tab and the
 * inbox's "Show client" panel — extracted from `ClientDetailPage` (#1095)
 * so both surfaces stay behind one derivation instead of two copies
 * drifting apart. See docs/design/1094/client-overview-inventory.md.
 */
export default function ClientOverviewStats({ dashboard, measurements, columns = 4 }: Props) {
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
    <div className={cn('grid grid-cols-1 gap-3', columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>
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
