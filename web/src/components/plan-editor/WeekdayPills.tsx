import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DAY_ORDER } from '@/components/plan-editor/plan-editor-format';
import { dayTotals, targetStatus, type TargetStatus } from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorWeek } from '@/components/plan-editor/plan-editor-types';

const DOT_CLASS: Record<TargetStatus, string | null> = {
  none: null,
  on: 'bg-success',
  near: 'bg-training-bright',
  off: 'bg-error',
};

interface Props {
  week: EditorWeek;
  current: number;
  dailyKcalTarget: number | undefined;
  onSelect: (dayOfWeek: number) => void;
}

/** Mon-Sun pills; each carries a dot for how close that day's kcal is to the target. */
export default function WeekdayPills({ week, current, dailyKcalTarget, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div role="tablist" aria-label={t('planEditor.day.weekdays')} className="flex flex-wrap gap-2">
      {DAY_ORDER.map((dayOfWeek) => {
        const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
        const status = day ? targetStatus(dayTotals(day).kcal, dailyKcalTarget) : 'none';
        const dot = DOT_CLASS[status];
        const active = dayOfWeek === current;
        return (
          <button
            key={dayOfWeek}
            type="button"
            role="tab"
            aria-selected={active}
            data-status={status}
            onClick={() => onSelect(dayOfWeek)}
            className={cn(
              'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-copy font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
            )}
          >
            {t(`planEditor.days.${dayOfWeek}`)}
            {dot && <span className={cn('size-1.75 rounded-full', dot)} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
