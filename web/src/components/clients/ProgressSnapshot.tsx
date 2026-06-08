import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientVerdictResponse } from '@/api/client-verdict';

interface WeightBar {
  pct: number;
  highlight: boolean;
}

interface ProgressSnapshotProps {
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  verdict?: ClientVerdictResponse | null;
  onAllMeasurementsClick: () => void;
}

export function ProgressSnapshot({
  startWeight,
  currentWeight,
  targetWeight,
  verdict,
  onAllMeasurementsClick,
}: ProgressSnapshotProps) {
  const { t } = useTranslation();

  // Build bar chart data from the weight series (same algorithm as old page)
  const bars = useMemo((): WeightBar[] => {
    if (startWeight == null || currentWeight == null) return [];

    const tgt = targetWeight ?? currentWeight;
    const values = [startWeight, currentWeight, tgt];
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const floor = Math.max(0, minVal - (maxVal - minVal) * 0.5);
    const range = maxVal - floor || 1;

    return [
      { pct: ((startWeight - floor) / range) * 100, highlight: false },
      { pct: ((currentWeight - floor) / range) * 100, highlight: true },
      { pct: ((tgt - floor) / range) * 100, highlight: false },
    ];
  }, [startWeight, currentWeight, targetWeight]);

  const weightDelta = startWeight != null && currentWeight != null
    ? Math.round((currentWeight - startWeight) * 10) / 10
    : null;
  const remaining = currentWeight != null && targetWeight != null
    ? Math.round(Math.abs(targetWeight - currentWeight) * 10) / 10
    : null;

  const prTotal = verdict?.prCountThisMonth ?? 0;

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
      {/* Weight progress bar chart */}
      <div className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium">
            {t('clientDetail.prehled.progress.weightTitle')}
          </div>
          <button
            type="button"
            onClick={onAllMeasurementsClick}
            className="text-[11px] font-semibold text-accent bg-transparent border-none cursor-pointer hover:underline"
          >
            {t('clientDetail.prehled.progress.allMeasurements')} →
          </button>
        </div>

        {bars.length > 0 ? (
          <>
            <div className="flex items-end gap-1.5 h-[72px] py-1">
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(bar.pct, 8)}%`,
                    backgroundColor: 'var(--accent)',
                    opacity: bar.highlight ? 0.7 : 0.45,
                  }}
                />
              ))}
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div className="text-[13px] text-text2">
                {startWeight} → <b className="text-text">{currentWeight} kg</b>
                {weightDelta != null && weightDelta !== 0 && (
                  <span className={`ml-1.5 text-[11px] ${weightDelta < 0 ? 'text-green' : 'text-orange'}`}>
                    ({weightDelta < 0 ? '' : '+'}{weightDelta} kg)
                  </span>
                )}
              </div>
              {remaining != null && targetWeight != null && (
                <div className="text-[12px] text-green">
                  {t('clientDetail.prehled.progress.remaining', { kg: remaining })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-[13px] text-text3 py-6 text-center">
            {t('clientDetail.prehled.progress.noData')}
          </div>
        )}
      </div>

      {/* This month stats tile */}
      <div className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5">
        <div className="text-[11px] text-text3 uppercase tracking-[0.04em] font-medium mb-2.5">
          {t('clientDetail.prehled.progress.thisMonth')}
        </div>
        <div className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between items-baseline">
            <span className="text-text2">
              🏆 {t('clientDetail.prehled.progress.stats.prTotal')}
            </span>
            <b className="text-[15px]">{prTotal}</b>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-text2">
              🏋️ {t('clientDetail.prehled.progress.stats.workouts')}
            </span>
            <b className="text-[15px]">
              {verdict?.trainingFrequencyActual != null ? verdict.trainingFrequencyActual : '—'}
            </b>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-text2">
              📏 {t('clientDetail.prehled.progress.stats.measurements')}
            </span>
            <b className="text-[15px]">—</b>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-text2">
              🥗 {t('clientDetail.prehled.progress.stats.completedDays')}
            </span>
            <b className="text-[15px]">
              {verdict?.compliancePercent != null ? `${verdict.compliancePercent} %` : '—'}
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}
