import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import { targetStatus, type WeekSummary } from '@/components/plan-editor/plan-editor-nutrition';

const STATUS_DOT_CLASS = {
  none: 'bg-ink',
  on: 'bg-success',
  near: 'bg-training-bright',
  off: 'bg-error',
} as const;

function Dot({ className }: { className: string }) {
  return <span className={cn('size-1.75 shrink-0 rounded-full', className)} aria-hidden="true" />;
}

interface Props {
  summary: WeekSummary;
  dailyKcalTarget: number | undefined;
}

/** One-line week summary: average per day against the target, macros and the week total. */
export default function AveragesBar({ summary, dailyKcalTarget }: Props) {
  const { t, i18n } = useTranslation();
  const { average, total } = summary;
  const status = targetStatus(average.kcal, dailyKcalTarget);

  return (
    <div
      data-testid="week-averages"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-card px-4 py-3 text-body text-ink"
    >
      <span className="font-semibold">{t('planEditor.averages.label')}</span>
      <span className="flex items-center gap-1.5">
        <Dot className={STATUS_DOT_CLASS[status]} />
        <span className="font-semibold">
          {dailyKcalTarget === undefined
            ? t('planEditor.averages.kcal', { value: formatKcal(average.kcal, i18n.language) })
            : t('planEditor.averages.kcalOfTarget', {
                value: formatKcal(average.kcal, i18n.language),
                target: formatKcal(dailyKcalTarget, i18n.language),
              })}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <Dot className="bg-macro-protein" />
        {t('planEditor.averages.protein', { value: Math.round(average.protein) })}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot className="bg-macro-carbs" />
        {t('planEditor.averages.carbs', { value: Math.round(average.carbs) })}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot className="bg-macro-fat" />
        {t('planEditor.averages.fat', { value: Math.round(average.fat) })}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot className="bg-macro-fibre" />
        {t('planEditor.averages.fiber', { grams: Math.round(average.fiber) })}
      </span>
      <span className="text-muted-foreground">
        {t('planEditor.averages.weekTotal', { kcal: formatKcal(total.kcal, i18n.language) })}
      </span>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={t('planEditor.comingSoon')}
        className="ml-auto inline-flex items-center gap-1 text-body text-muted-foreground opacity-60"
      >
        {t('planEditor.averages.details')}
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
