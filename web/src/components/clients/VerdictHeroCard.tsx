import { useTranslation } from 'react-i18next';
import type { GetClientVerdictResponse } from '@/api/client-verdict';
import { ClientVerdict, WeightDirection } from '@/api/client-verdict';

interface VerdictHeroCardProps {
  verdict: GetClientVerdictResponse;
}

export function VerdictHeroCard({ verdict }: VerdictHeroCardProps) {
  const { t } = useTranslation();

  const isOnTrack = verdict.verdict === ClientVerdict.OnTrack;
  const isNeedsAttention = verdict.verdict === ClientVerdict.NeedsAttention;

  const borderClass = isOnTrack
    ? 'border-green-bg'
    : isNeedsAttention
      ? 'border-orange-bg'
      : 'border-red-bg';

  const bgClass = isOnTrack
    ? 'bg-green-bg'
    : isNeedsAttention
      ? 'bg-orange-bg'
      : 'bg-red-bg';

  const emoji = isOnTrack ? '✅' : isNeedsAttention ? '⚠️' : '🔴';

  const labelKey = isOnTrack
    ? 'clientDetail.verdict.onTrack.label'
    : isNeedsAttention
      ? 'clientDetail.verdict.needsAttention.label'
      : 'clientDetail.verdict.offTrack.label';

  const subtitleKey = isOnTrack
    ? 'clientDetail.verdict.onTrack.subtitle'
    : isNeedsAttention
      ? 'clientDetail.verdict.needsAttention.subtitle'
      : 'clientDetail.verdict.offTrack.subtitle';

  const valueColorClass = isOnTrack
    ? 'text-green'
    : isNeedsAttention
      ? 'text-orange'
      : 'text-red';

  const labelColorClass = isOnTrack
    ? 'text-green'
    : isNeedsAttention
      ? 'text-orange'
      : 'text-red';

  // Format weight delta signal
  const weightSignal = verdict.weightDeltaToGoal != null
    ? `${verdict.weightDeltaToGoal < 0 ? '' : '+'}${verdict.weightDeltaToGoal.toFixed(1)} kg ${verdict.weightDirection === WeightDirection.Towards ? '↘' : verdict.weightDirection === WeightDirection.Away ? '↗' : '→'}`
    : '—';

  // Training frequency signal
  const trainingSignal = verdict.trainingFrequencyActual != null && verdict.trainingFrequencyPrescribed != null
    ? `${verdict.trainingFrequencyActual} / ${verdict.trainingFrequencyPrescribed}`
    : '—';

  return (
    <div
      className={`flex items-center gap-4 flex-wrap border ${borderClass} ${bgClass} rounded-[var(--radius-lg)] px-5 py-4 mb-4`}
      style={{ borderColor: `var(--${isOnTrack ? 'green' : isNeedsAttention ? 'orange' : 'red'}-br)` }}
    >
      {/* Emoji + label */}
      <div className="flex items-center gap-2.5">
        <div className="text-[24px] leading-none">{emoji}</div>
        <div>
          <div className={`text-[17px] font-bold tracking-[-0.01em] ${labelColorClass}`}>
            {t(labelKey)}
          </div>
          <div className="text-[12px] text-text3 mt-0.5">
            {t(subtitleKey)}
          </div>
        </div>
      </div>

      {/* Signal stats */}
      <div className="flex gap-6 ml-auto flex-wrap">
        {/* Compliance */}
        <div className="text-center">
          <div className={`text-[17px] font-bold leading-none ${verdict.compliancePercent != null ? valueColorClass : 'text-text3'}`}>
            {verdict.compliancePercent != null ? `${verdict.compliancePercent} %` : '—'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-text3 mt-0.5">
            {t('clientDetail.verdict.signals.compliance')}
          </div>
        </div>

        {/* Weight delta */}
        <div className="text-center">
          <div className={`text-[17px] font-bold leading-none ${verdict.weightDeltaToGoal != null ? valueColorClass : 'text-text3'}`}>
            {weightSignal}
          </div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-text3 mt-0.5">
            {t('clientDetail.verdict.signals.weightDelta')}
          </div>
        </div>

        {/* Training frequency */}
        <div className="text-center">
          <div className="text-[17px] font-bold leading-none text-text">
            {trainingSignal}
          </div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-text3 mt-0.5">
            {t('clientDetail.verdict.signals.trainingsPerWeek')}
          </div>
        </div>

        {/* PR this month */}
        <div className="text-center">
          <div className="text-[17px] font-bold leading-none text-text">
            {verdict.prCountThisMonth ?? '—'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.04em] text-text3 mt-0.5">
            {t('clientDetail.verdict.signals.prThisMonth')}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fallback rendered when the verdict query fails (404/403). */
export function VerdictHeroCardError() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 border border-border bg-bg2 rounded-[var(--radius-lg)] px-5 py-4 mb-4">
      <div className="text-[20px] leading-none text-text3">—</div>
      <div className="text-[13px] text-text3">{t('clientDetail.verdict.unavailable')}</div>
    </div>
  );
}

/** Skeleton loading state for the verdict hero. */
export function VerdictHeroCardSkeleton() {
  return (
    <div className="flex items-center gap-4 border border-border bg-bg2 rounded-[var(--radius-lg)] px-5 py-4 mb-4 animate-pulse">
      <div className="w-6 h-6 bg-bg3 rounded-full" />
      <div className="h-4 bg-bg3 rounded w-32" />
      <div className="ml-auto flex gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <div className="h-5 bg-bg3 rounded w-12 mb-1" />
            <div className="h-2.5 bg-bg3 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
