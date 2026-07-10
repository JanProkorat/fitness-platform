import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToastStore } from '@/stores/toast';
import { getClientMeasurements } from '@/api/measurements';
import type { MeasurementDto } from '@/api/generated';
import { formatClientDate } from '@/lib/date-format';
import { EmptyState } from '@/components/clients/EmptyState';

interface MereniTabProps {
  clientId: string;
  targetWeightKg: number | null | undefined;
}

// ── Delta helpers ─────────────────────────────────────────────────────────────

/** ISO 8601 string → Date */
function toDate(iso: string | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

/** Number of milliseconds in 6 weeks */
const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

interface StatTile {
  label: string;
  value: string;
  delta: string | null;
  /** delta colour: 'green' | 'orange' | null */
  deltaColor: 'green' | 'orange' | null;
  accent: boolean;
  sub: string | null;
}

function formatNum(
  v: number | undefined | null,
  unit: string,
  decimals = 1,
): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals).replace('.', ',')} ${unit}`;
}

function formatDelta(
  diff: number | null,
  unit: string,
  decimals = 1,
): string | null {
  if (diff == null) return null;
  if (diff === 0) return `${(0).toFixed(decimals).replace('.', ',')} ${unit}`;
  const sign = diff < 0 ? '' : '+';
  return `${sign}${diff.toFixed(decimals).replace('.', ',')} ${unit}`;
}

/**
 * Find the reference measurement for delta comparison:
 * the most recent measurement that is at least 6 weeks before `latest`.
 */
function findReferenceAtLeast6WeeksBefore(
  sorted: MeasurementDto[],
  latestDate: Date,
): MeasurementDto | null {
  for (let i = 1; i < sorted.length; i++) {
    const d = toDate(sorted[i].measuredAt);
    if (d && latestDate.getTime() - d.getTime() >= SIX_WEEKS_MS) {
      return sorted[i];
    }
  }
  return null;
}

// ── Bar chart helpers ─────────────────────────────────────────────────────────

interface WeightBar {
  pct: number;
  opacity: number;
}

/**
 * Build up to 8 bars from the most recent measurements, oldest-first for display.
 * Uses the same normalization logic as ProgressSnapshot.
 */
function buildWeightBars(sorted: MeasurementDto[]): WeightBar[] {
  const slice = sorted.slice(0, 8).reverse(); // oldest → newest
  const weights = slice
    .map((m) => m.weightKg)
    .filter((w): w is number => w != null);
  if (weights.length === 0) return [];

  const maxVal = Math.max(...weights);
  const minVal = Math.min(...weights);
  const floor = Math.max(0, minVal - (maxVal - minVal) * 0.5);
  const range = maxVal - floor || 1;

  return slice.map((m, i) => {
    const w = m.weightKg ?? minVal;
    const pct = Math.max(((w - floor) / range) * 100, 8);
    // Opacity ramps from 0.35 (oldest) to 0.7 (newest), matching prototype style
    const opacity = 0.35 + (i / Math.max(slice.length - 1, 1)) * 0.35;
    return { pct, opacity };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MereniTab({ clientId, targetWeightKg }: MereniTabProps) {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const { data, isError, isPending } = useQuery({
    queryKey: ['client-measurements', clientId],
    queryFn: () => getClientMeasurements(clientId),
    enabled: Boolean(clientId),
    retry: false,
  });

  const items = data?.items;
  // Sorted newest-first
  const sorted: MeasurementDto[] = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => {
      const da = toDate(a.measuredAt)?.getTime() ?? 0;
      const db = toDate(b.measuredAt)?.getTime() ?? 0;
      return db - da;
    });
  }, [items]);

  const latest = sorted[0] ?? null;

  // Reference measurement for deltas (>=6 weeks before latest)
  const refMeasurement: MeasurementDto | null = useMemo(() => {
    if (!latest?.measuredAt) return null;
    const latestDate = toDate(latest.measuredAt);
    if (!latestDate) return null;
    return findReferenceAtLeast6WeeksBefore(sorted, latestDate);
  }, [sorted, latest]);

  // ── Stat tiles ──────────────────────────────────────────────────────────────

  const tiles: StatTile[] = useMemo(() => {
    const weightDiff =
      latest?.weightKg != null && refMeasurement?.weightKg != null
        ? Math.round((latest.weightKg - refMeasurement.weightKg) * 10) / 10
        : null;

    const fatDiff =
      latest?.bodyFatPercentage != null &&
      refMeasurement?.bodyFatPercentage != null
        ? Math.round(
            (latest.bodyFatPercentage - refMeasurement.bodyFatPercentage) * 10,
          ) / 10
        : null;

    const waistDiff =
      latest?.waistCm != null && refMeasurement?.waistCm != null
        ? Math.round((latest.waistCm - refMeasurement.waistCm) * 10) / 10
        : null;

    const remaining =
      latest?.weightKg != null && targetWeightKg != null
        ? Math.round(Math.abs(targetWeightKg - latest.weightKg) * 10) / 10
        : null;

    return [
      {
        label: t('clientDetail.mereni.tiles.currentWeight'),
        value: formatNum(latest?.weightKg, 'kg'),
        delta: formatDelta(weightDiff, 'kg'),
        deltaColor:
          weightDiff == null || weightDiff === 0
            ? null
            : weightDiff < 0
              ? 'green'
              : 'orange',
        accent: false,
        sub: refMeasurement?.measuredAt
          ? t('clientDetail.mereni.tiles.comparedToWeeksAgo')
          : null,
      },
      {
        label: t('clientDetail.mereni.tiles.bodyFat'),
        value: formatNum(latest?.bodyFatPercentage, '%'),
        delta: formatDelta(fatDiff, '%'),
        deltaColor:
          fatDiff == null || fatDiff === 0
            ? null
            : fatDiff < 0
              ? 'green'
              : 'orange',
        accent: false,
        sub: null,
      },
      {
        label: t('clientDetail.mereni.tiles.waist'),
        value: formatNum(latest?.waistCm, 'cm', 0),
        delta: formatDelta(waistDiff, 'cm', 0),
        deltaColor:
          waistDiff == null || waistDiff === 0
            ? null
            : waistDiff < 0
              ? 'green'
              : 'orange',
        accent: false,
        sub: null,
      },
      {
        label: t('clientDetail.mereni.tiles.toGoal'),
        value:
          remaining != null ? formatNum(remaining, 'kg') : '—',
        delta: null,
        deltaColor: null,
        accent: true,
        sub:
          targetWeightKg != null
            ? t('clientDetail.mereni.tiles.goalWeight', {
                kg: targetWeightKg.toFixed(1).replace('.', ','),
              })
            : null,
      },
    ];
  }, [latest, refMeasurement, targetWeightKg, t]);

  // ── Bar chart ──────────────────────────────────────────────────────────────

  const bars = useMemo(() => buildWeightBars(sorted), [sorted]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasData = sorted.length > 0;

  return (
    <div id="cl-pane-mereni">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[15px] font-semibold text-text">
          {t('clientDetail.mereni.title')}
        </div>
        <button
          type="button"
          className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors"
          onClick={() =>
            addToast(t('clientDetail.mereni.addMeasurementPlaceholder'), 'success')
          }
        >
          + {t('clientDetail.mereni.addMeasurement')}
        </button>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('common.loading')}
        </div>
      )}

      {/* Error */}
      {isError && !isPending && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('clientDetail.mereni.errorLoading')}
        </div>
      )}

      {/* Empty state */}
      {!isPending && !isError && !hasData && (
        <EmptyState
          icon="📏"
          title={t('clientDetail.mereni.emptyTitle')}
          description={t('clientDetail.mereni.emptyDescription')}
          action={
            <button
              type="button"
              className="mt-1 text-[13px] font-semibold text-accent hover:underline bg-transparent border-none cursor-pointer"
              onClick={() =>
                addToast(t('clientDetail.mereni.addMeasurementPlaceholder'), 'success')
              }
            >
              + {t('clientDetail.mereni.addFirstMeasurement')}
            </button>
          }
        />
      )}

      {/* Data sections */}
      {!isPending && !isError && hasData && (
        <>
          {/* 4-col stat tiles */}
          <div className="grid grid-cols-4 gap-3 mb-[18px]">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5"
              >
                <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-1.5">
                  {tile.label}
                </div>
                <div
                  className="text-[22px] font-semibold leading-tight"
                  style={tile.accent ? { color: 'var(--accent)' } : undefined}
                >
                  {tile.accent ? (
                    <span style={{ color: 'var(--accent)' }}>{tile.value}</span>
                  ) : (
                    <span className="text-text">{tile.value}</span>
                  )}
                </div>
                {tile.delta && (
                  <div
                    className={`text-[11px] mt-1 ${
                      tile.deltaColor === 'green'
                        ? 'text-green'
                        : tile.deltaColor === 'orange'
                          ? 'text-orange'
                          : 'text-text3'
                    }`}
                  >
                    {tile.delta}
                    {tile.sub ? ` ${tile.sub}` : ''}
                  </div>
                )}
                {!tile.delta && tile.sub && (
                  <div className="text-[11px] text-text3 mt-1">{tile.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* 8-week weight-trend bar chart */}
          {bars.length > 0 && (
            <div className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5 mb-[18px]">
              <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-3">
                {t('clientDetail.mereni.chartLabel')}
              </div>
              <div
                className="flex items-end gap-2"
                style={{ height: '120px', paddingTop: '4px', paddingBottom: '4px' }}
              >
                {bars.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${bar.pct}%`,
                      backgroundColor: 'var(--accent)',
                      opacity: bar.opacity,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Measurement history table */}
          <div className="db-wrap overflow-x-auto">
            <table className="db-table w-full text-[13px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                    {t('clientDetail.mereni.table.date')}
                  </th>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                    {t('clientDetail.mereni.table.weight')}
                  </th>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                    {t('clientDetail.mereni.table.bodyFat')}
                  </th>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                    {t('clientDetail.mereni.table.waist')}
                  </th>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2 pr-4">
                    {t('clientDetail.mereni.table.hips')}
                  </th>
                  <th className="text-left text-[11px] text-text3 font-medium uppercase tracking-[0.04em] py-2">
                    {t('clientDetail.mereni.table.chest')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => {
                  const dateStr = formatClientDate(m.measuredAt, i18n.language, 'numeric', '—');
                  return (
                    <tr key={m.measurementId ?? m.measuredAt} className="border-t border-border">
                      <td className="row-title py-2 pr-4 font-medium text-text">
                        {dateStr}
                      </td>
                      <td className="py-2 pr-4 text-text2">
                        {formatNum(m.weightKg, 'kg')}
                      </td>
                      <td className="py-2 pr-4 text-text2">
                        {formatNum(m.bodyFatPercentage, '%')}
                      </td>
                      <td className="py-2 pr-4 text-text2">
                        {formatNum(m.waistCm, 'cm', 0)}
                      </td>
                      <td className="py-2 pr-4 text-text2">
                        {formatNum(m.hipsCm, 'cm', 0)}
                      </td>
                      <td className="py-2 text-text2">
                        {formatNum(m.chestCm, 'cm', 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
