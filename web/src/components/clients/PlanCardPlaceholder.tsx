import { useTranslation } from 'react-i18next';

interface PlanCardPlaceholderProps {
  type: 'nutrition' | 'training';
  onCreatePlan?: () => void;
}

export function PlanCardPlaceholder({ type, onCreatePlan }: PlanCardPlaceholderProps) {
  const { t } = useTranslation();

  const icon = type === 'nutrition' ? '🥗' : '🏋️';
  const labelKey = type === 'nutrition'
    ? 'clientDetail.prehled.noActivePlan.nutrition'
    : 'clientDetail.prehled.noActivePlan.training';
  const ctaKey = type === 'nutrition'
    ? 'clientDetail.prehled.noActivePlan.createNutrition'
    : 'clientDetail.prehled.noActivePlan.createTraining';

  return (
    <div className="border border-border border-dashed rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
      <div className="text-[28px] opacity-40">{icon}</div>
      <div className="text-[13px] text-text3">{t(labelKey)}</div>
      {onCreatePlan && (
        <button
          type="button"
          onClick={onCreatePlan}
          className="mt-1 text-[12px] font-medium text-accent hover:underline bg-transparent border-none cursor-pointer"
        >
          {t(ctaKey)}
        </button>
      )}
    </div>
  );
}
