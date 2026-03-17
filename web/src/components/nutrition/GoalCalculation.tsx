import { useTranslation } from 'react-i18next';

const ACTIVITY_FACTORS: Record<string, number> = {
  Sedentary: 1.2,
  LightlyActive: 1.375,
  ModeratelyActive: 1.55,
  VeryActive: 1.725,
  ExtremelyActive: 1.9,
};

const GOAL_ADJUSTMENTS: Record<string, number> = {
  Cut: -0.2,
  Maintain: 0,
  Bulk: 0.1,
};

interface GoalCalculationProps {
  bmr: number;
  tdee: number;
  adjustedKcal: number;
  activityLevel: string;
  goal: string;
}

export default function GoalCalculation({
  bmr,
  tdee,
  adjustedKcal,
  activityLevel,
  goal,
}: GoalCalculationProps) {
  const { t } = useTranslation();
  const factor = ACTIVITY_FACTORS[activityLevel] ?? 1.55;
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0;
  const adjustmentLabel =
    adjustment < 0
      ? `${(adjustment * 100).toFixed(0)}%`
      : adjustment > 0
        ? `+${(adjustment * 100).toFixed(0)}%`
        : '0%';

  const steps = [
    {
      label: t('nutritionGoals.bmr'),
      value: Math.round(bmr),
      detail: 'Mifflin-St Jeor',
    },
    {
      label: t('nutritionGoals.tdee'),
      value: Math.round(tdee),
      detail: `BMR x ${factor}`,
    },
    {
      label: t('nutritionGoals.finalKcal'),
      value: Math.round(adjustedKcal),
      detail: `TDEE ${adjustmentLabel}`,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
        {t('nutritionGoals.results')}
      </h2>

      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <div className="flex min-w-[140px] flex-col rounded-sm border border-border bg-surface p-4 text-center">
              <span className="text-xs text-muted">{step.label}</span>
              <span className="mt-1 text-2xl font-bold text-text">
                {step.value}
              </span>
              <span className="text-[11px] text-gold-dim">{step.detail}</span>
            </div>
            {i < steps.length - 1 && (
              <svg
                className="h-5 w-5 shrink-0 text-gold-dim"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
