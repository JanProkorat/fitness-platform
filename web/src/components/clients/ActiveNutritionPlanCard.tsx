import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { PlanSummary, GlobalNutritionSettings } from '@/api/plan-types';
import { formatClientDate as formatDate } from '@/lib/date-format';

interface ActiveNutritionPlanCardProps {
  plan: PlanSummary;
  /** Macro targets from the plan detail. PlanSummary does not carry globalSettings. */
  globalSettings?: GlobalNutritionSettings | null;
  targetWeightKg?: number | null;
  goalLabel?: string | null;
  compliancePercent?: number | null;
  onHistoryClick: () => void;
}

export function ActiveNutritionPlanCard({
  plan,
  globalSettings,
  targetWeightKg,
  goalLabel,
  compliancePercent,
  onHistoryClick,
}: ActiveNutritionPlanCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const gs = globalSettings;
  const periodStart = formatDate(plan.startDate, i18n.language);
  const periodEnd = formatDate(plan.dateCompleted, i18n.language);
  const period = periodStart && periodEnd
    ? `${periodStart} – ${periodEnd}`
    : periodStart
      ? t('clientDetail.prehled.planCard.from', { date: periodStart })
      : '';

  const complianceColor = compliancePercent != null
    ? compliancePercent >= 80
      ? 'text-green bg-green-bg'
      : compliancePercent >= 60
        ? 'text-orange bg-orange-bg'
        : 'text-red bg-red-bg'
    : 'text-text3 bg-bg3';

  return (
    <div
      onClick={() => navigate(`/nutrition/plans/${plan.planId}`)}
      className="border border-border rounded-[var(--radius-lg)] p-4 cursor-pointer transition-[border-color] hover:border-accent-br"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/nutrition/plans/${plan.planId}`); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-bold text-text">🥗 {plan.name}</div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-bg text-green">
          {t('clientDetail.prehled.planCard.active')}
        </span>
      </div>

      {/* Period */}
      {period && (
        <div className="text-[11px] text-text3 mb-2.5">{period}</div>
      )}

      {/* Goal */}
      {(goalLabel || targetWeightKg != null) && (
        <div className="text-[13px] text-text2 mb-1.5">
          {t('clientDetail.prehled.planCard.goal')}:{' '}
          {goalLabel && <b className="text-text">{goalLabel}</b>}
          {goalLabel && targetWeightKg != null && ' → '}
          {targetWeightKg != null && (
            <b className="text-text">
              {t('clientDetail.prehled.planCard.targetWeight', { kg: targetWeightKg })}
            </b>
          )}
        </div>
      )}

      {/* Macros */}
      {gs?.dailyKcal != null && (
        <div className="text-[16px] font-bold text-accent tracking-[-0.01em] mb-2.5">
          {gs.dailyKcal} kcal
          {gs.proteinGrams != null && ` · ${gs.proteinGrams} P`}
          {gs.carbsGrams != null && ` / ${gs.carbsGrams} C`}
          {gs.fatGrams != null && ` / ${gs.fatGrams} F`}
        </div>
      )}

      {/* Compliance pills */}
      {compliancePercent != null && (
        <div className="flex gap-1.5 mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${complianceColor}`}>
            {t('clientDetail.prehled.planCard.compliance', { pct: compliancePercent })}
          </span>
        </div>
      )}

      {/* Footer links */}
      <div className="flex items-center justify-between mt-auto pt-0.5">
        <span className="text-[12px] font-semibold text-accent">
          {t('clientDetail.prehled.planCard.openNutrition')} →
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onHistoryClick(); }}
          className="text-[12px] text-text3 bg-transparent border-none cursor-pointer hover:text-text2 transition-colors"
        >
          {t('clientDetail.prehled.planCard.history')}
        </button>
      </div>
    </div>
  );
}
