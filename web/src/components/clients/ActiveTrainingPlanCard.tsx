import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TrainingPlanSummary } from '@/api/training-plan-types';
import type { TopPrRecord } from '@/components/domain/RecentActivity/useRecentActivityAggregates';
import { formatClientDate as formatDate } from '@/lib/date-format';

interface ActiveTrainingPlanCardProps {
  plan: TrainingPlanSummary;
  /** Number of sessions completed this week. */
  trainingFrequencyActual?: number | null;
  /** Sessions prescribed per week. */
  trainingFrequencyPrescribed?: number | null;
  /** Number of PRs achieved this month. */
  prCountThisMonth?: number;
  /** Top personal record this month derived from the client timeline. */
  topPr?: TopPrRecord | null;
  onHistoryClick: () => void;
}

export function ActiveTrainingPlanCard({
  plan,
  trainingFrequencyActual,
  trainingFrequencyPrescribed,
  prCountThisMonth,
  topPr,
  onHistoryClick,
}: ActiveTrainingPlanCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const periodStart = formatDate(plan.startDate, i18n.language);
  const period = periodStart
    ? t('clientDetail.prehled.planCard.from', { date: periodStart })
    : '';

  const frequencyLabel = trainingFrequencyPrescribed != null
    ? t('clientDetail.prehled.trainingCard.weeklyFrequency', { count: trainingFrequencyPrescribed })
    : null;

  const thisWeekLabel = trainingFrequencyActual != null
    ? t('clientDetail.prehled.trainingCard.thisWeek', { count: trainingFrequencyActual })
    : null;

  return (
    <div
      onClick={() => navigate(`/training/plans/${plan.planId}`)}
      className="border border-border rounded-[var(--radius-lg)] p-4 cursor-pointer transition-[border-color] hover:border-accent-br"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/training/plans/${plan.planId}`); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-[14px] font-bold text-text">🏋️ {plan.name}</div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-bg text-green">
          {t('clientDetail.prehled.planCard.active')}
        </span>
      </div>

      {/* Period */}
      {period && (
        <div className="text-[11px] text-text3 mb-2.5">{period}</div>
      )}

      {/* Description + frequency */}
      {(plan.description || frequencyLabel) && (
        <div className="text-[13px] text-text2 mb-1.5">
          {frequencyLabel && <b className="text-text">{frequencyLabel}</b>}
          {plan.description && frequencyLabel && ' · '}
          {plan.description && <b className="text-text">{plan.description}</b>}
        </div>
      )}

      {/* PR count + top PR */}
      {prCountThisMonth != null && (
        <div className="text-[16px] font-bold text-accent tracking-[-0.01em] mb-1">
          {t('clientDetail.prehled.trainingCard.prThisMonth', { count: prCountThisMonth })}
        </div>
      )}
      {topPr && (
        <div className="text-[12px] text-text2 mb-2.5">
          {t('clientDetail.prehled.trainingCard.topPr', {
            name: topPr.exerciseName,
            kg: topPr.weightKg,
            reps: topPr.reps,
          })}
        </div>
      )}

      {/* Pills */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {thisWeekLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-bg text-green">
            {thisWeekLabel}
          </span>
        )}
      </div>

      {/* Footer links */}
      <div className="flex items-center justify-between mt-auto pt-0.5">
        <span className="text-[12px] font-semibold text-accent">
          {t('clientDetail.prehled.trainingCard.openTraining')} →
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
