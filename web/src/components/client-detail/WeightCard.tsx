import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { computeWeeklyWeightDelta, formatSignedNumber, selectRecentWeightPoints } from '@/lib/client-metrics';
import type { GetClientDashboardResponse, MeasurementDto } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  measurements: MeasurementDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

const POINT_COUNT = 8;
const CHART_WIDTH = 400;
const CHART_HEIGHT = 124;
const X_MIN = 10;
const X_MAX = 388;
const Y_TOP = 20;
const Y_BOTTOM = 110;

function yFor(value: number, min: number, max: number): number {
  if (max === min) {
    return (Y_TOP + Y_BOTTOM) / 2;
  }
  return Y_TOP + ((max - value) / (max - min)) * (Y_BOTTOM - Y_TOP);
}

/** "Weight" card: latest reading, hand-drawn line over the last eight measurements and a dashed goal line. */
export default function WeightCard({ dashboard, measurements, isPending, isError, onRetry }: Props) {
  const { t, i18n } = useTranslation();

  const points = selectRecentWeightPoints(measurements, POINT_COUNT);
  const goalKg = dashboard.onboarding?.targetWeightKg;
  const delta = computeWeeklyWeightDelta(measurements);
  const first = points.length > 0 ? points[0] : undefined;
  const last = points.length > 0 ? points[points.length - 1] : undefined;
  const latestMeasurement = [...measurements]
    .filter((m) => m.measuredAt != null)
    .sort((a, b) => new Date(b.measuredAt!).getTime() - new Date(a.measuredAt!).getTime())[0];

  const formatDay = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(iso));
  const formatNumber = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  const headerCaption = [
    delta != null ? t('clientDetail.overview.weight.deltaThisWeek', { delta: formatSignedNumber(delta) }) : undefined,
    goalKg != null ? t('clientDetail.overview.weight.goal', { goal: formatNumber(goalKg) }) : undefined,
  ]
    .filter((segment): segment is string => Boolean(segment))
    .join(' • ');

  const bodyParts = [
    latestMeasurement?.bodyFatPercentage != null
      ? t('clientDetail.overview.weight.bodyFat', { value: formatNumber(latestMeasurement.bodyFatPercentage) })
      : undefined,
    latestMeasurement?.waistCm != null
      ? t('clientDetail.overview.weight.waist', { value: formatNumber(latestMeasurement.waistCm) })
      : undefined,
  ]
    .filter((segment): segment is string => Boolean(segment))
    .join(' • ');

  const values = points.map((point) => point.weightKg);
  const scaleValues = goalKg != null ? [...values, goalKg] : values;
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);
  const xFor = (index: number) =>
    points.length === 1 ? (X_MIN + X_MAX) / 2 : X_MIN + (index / (points.length - 1)) * (X_MAX - X_MIN);
  const polyline = points.map((point, index) => `${xFor(index)},${yFor(point.weightKg, min, max)}`).join(' ');

  const chartLabel =
    first && last
      ? t('clientDetail.overview.weight.chartLabel', {
          from: formatNumber(first.weightKg),
          to: formatNumber(last.weightKg),
          n: points.length,
        })
      : '';

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4.5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-copy font-semibold text-ink">{t('clientDetail.overview.weight.heading')}</h2>
        <span className="text-meta text-muted-foreground">
          {t('clientDetail.overview.weight.lastMeasurements', { count: POINT_COUNT })}
        </span>
      </div>

      {isPending && <Skeleton className="h-32 w-full" />}

      {!isPending && isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-meta text-muted-foreground">{t('common.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!isPending && !isError && (!first || !last) && (
        <p className="text-meta text-muted-foreground">{t('clientDetail.overview.weight.empty')}</p>
      )}

      {!isPending && !isError && first && last && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-title font-semibold text-ink">
              {t('clientDetail.overview.weight.value', { kg: formatNumber(last.weightKg) })}
            </span>
            {headerCaption && <span className="text-meta text-muted-foreground">{headerCaption}</span>}
          </div>

          <svg
            width="100%"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={chartLabel}
            className="overflow-visible"
          >
            {goalKg != null && (
              <line
                x1={X_MIN}
                x2={X_MAX + 2}
                y1={yFor(goalKg, min, max)}
                y2={yFor(goalKg, min, max)}
                className="stroke-nutrition"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            )}
            {points.length > 1 && (
              <polyline
                points={polyline}
                fill="none"
                className="stroke-ink"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <circle
              cx={xFor(points.length - 1)}
              cy={yFor(last.weightKg, min, max)}
              r={4.5}
              className="fill-ink"
            />
          </svg>

          <div className="flex text-caption text-muted-foreground">
            <span>{t('clientDetail.overview.weight.pointLabel', { date: formatDay(first.measuredAt), kg: formatNumber(first.weightKg) })}</span>
            {points.length > 1 && (
              <span className="ml-auto">
                {t('clientDetail.overview.weight.pointLabel', { date: formatDay(last.measuredAt), kg: formatNumber(last.weightKg) })}
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-xs bg-ink" aria-hidden="true" />
              {t('clientDetail.overview.weight.legendWeight')}
            </span>
            {goalKg != null && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t-2 border-dashed border-nutrition" aria-hidden="true" />
                {t('clientDetail.overview.weight.legendGoal', { goal: formatNumber(goalKg) })}
              </span>
            )}
            {bodyParts && <span className="ml-auto">{bodyParts}</span>}
          </div>
        </>
      )}
    </div>
  );
}
