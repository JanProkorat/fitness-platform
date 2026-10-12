import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tone: 'nutrition' | 'training';
  label: string;
  heading: string;
}

/**
 * Header row of a plan card: coloured dot + kicker label + muted heading on
 * the left, and a disabled "Open plan" link on the right. No client plan
 * route exists yet, so it carries the shell's coming-soon treatment.
 */
export default function PlanCardHeader({ tone, label, heading }: Props) {
  const { t } = useTranslation();
  const isNutrition = tone === 'nutrition';

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', isNutrition ? 'bg-nutrition' : 'bg-training')}
        />
        <span
          className={cn(
            'shrink-0 text-caption font-semibold uppercase tracking-wider',
            isNutrition ? 'text-nutrition-ink' : 'text-training-ink',
          )}
        >
          {label}
        </span>
        <h2 className="truncate text-caption text-muted-foreground">{heading}</h2>
      </div>
      <button
        type="button"
        disabled
        title={t('shell.comingSoon')}
        className="flex shrink-0 items-center gap-0.5 text-body font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t(isNutrition ? 'clientDetail.overview.mealPlan.openPlan' : 'clientDetail.overview.workout.openPlan')}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
