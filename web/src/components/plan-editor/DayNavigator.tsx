import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  weekIndex: number;
  weekCount: number;
  onWeekChange: (delta: -1 | 1) => void;
}

/** "Week 5 of 12" with previous/next buttons and a dot per week. */
export default function DayNavigator({ weekIndex, weekCount, onWeekChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={t('planEditor.day.previousWeek')}
        disabled={weekIndex <= 0}
        onClick={() => onWeekChange(-1)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="flex min-w-24 flex-col gap-0.5">
        <span className="font-display text-panel-title font-semibold text-ink" data-testid="day-week-title">
          {t('planEditor.weeks.week', { number: weekIndex + 1 })}
        </span>
        <span className="text-label text-muted-foreground">{t('planEditor.day.ofWeeks', { total: weekCount })}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={t('planEditor.day.nextWeek')}
        disabled={weekIndex >= weekCount - 1}
        onClick={() => onWeekChange(1)}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
      <div className="hidden items-center gap-1 lg:flex" aria-hidden="true">
        {Array.from({ length: weekCount }, (_, index) => (
          <span
            key={index}
            className={cn('h-1.5 rounded-full', index === weekIndex ? 'w-4 bg-ink' : 'w-1.5 bg-line')}
          />
        ))}
      </div>
    </div>
  );
}
