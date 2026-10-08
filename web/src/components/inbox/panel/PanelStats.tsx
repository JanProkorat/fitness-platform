import { useTranslation } from 'react-i18next';
import { formatClientDate } from '@/lib/date-format';
import { computeWeeklyWeightDelta, daysSince, formatSignedNumber } from '@/lib/client-metrics';
import type { GetClientDashboardResponse, MeasurementDto } from '@/api/generated';

interface StatProps {
  label: string;
  value: string;
  caption?: string;
}

function PanelStat({ label, value, caption }: StatProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4.5 py-4 shadow-panel">
      <span className="text-label font-semibold uppercase tracking-label text-muted-foreground">{label}</span>
      <span className="font-display text-title font-semibold text-ink">{value}</span>
      {caption && <span className="text-meta text-muted-foreground">{caption}</span>}
    </div>
  );
}

interface Props {
  dashboard: GetClientDashboardResponse;
  measurements: MeasurementDto[];
}

/** Weight + "client since" stat cards. The rating/payments placeholders of the client-detail page are not shown here. */
export default function PanelStats({ dashboard, measurements }: Props) {
  const { t, i18n } = useTranslation();

  const weightDeltaKg = computeWeeklyWeightDelta(measurements);
  const currentWeightKg = dashboard.latestMeasurement?.weightKg ?? dashboard.weightKg;
  const linkedDays = dashboard.linkedAt ? daysSince(dashboard.linkedAt) : undefined;

  const weightCaption =
    currentWeightKg == null
      ? t('clientDetail.overview.stats.weight.noMeasurements')
      : weightDeltaKg != null
        ? t('clientDetail.overview.stats.weight.deltaThisWeek', { delta: formatSignedNumber(weightDeltaKg) })
        : undefined;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <PanelStat
        label={t('inbox.panel.weightLabel')}
        value={
          currentWeightKg != null
            ? t('clientDetail.overview.stats.weight.value', { kg: currentWeightKg })
            : t('clientDetail.overview.stats.weight.empty')
        }
        caption={weightCaption}
      />
      <PanelStat
        label={t('clientDetail.overview.stats.clientSince.label')}
        value={
          linkedDays != null
            ? t('clientDetail.overview.stats.clientSince.days', { count: linkedDays })
            : t('clientDetail.overview.stats.weight.empty')
        }
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
