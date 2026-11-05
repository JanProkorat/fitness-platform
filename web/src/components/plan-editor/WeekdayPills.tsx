import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConflictBadge from '@/components/plan-editor/sync-conflicts/ConflictBadge';
import { useSyncConflicts } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import { isPastDay, isToday, useMealLocks } from '@/components/plan-editor/meal-locks';
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
  /** Position of the week in the plan (0-based); lets a pill show that day's offline-sync conflicts. */
  weekIndex?: number;
  current: number;
  dailyKcalTarget: number | undefined;
  onSelect: (dayOfWeek: number) => void;
}

/** Mon-Sun pills; each carries a dot for how close that day's kcal is to the target. */
export default function WeekdayPills({ week, weekIndex, current, dailyKcalTarget, onSelect }: Props) {
  const { t } = useTranslation();
  const conflicts = useSyncConflicts();
  const locks = useMealLocks();

  return (
    <div role="tablist" aria-label={t('planEditor.day.weekdays')} className="flex flex-wrap gap-2">
      {DAY_ORDER.map((dayOfWeek) => {
        const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
        const status = day ? targetStatus(dayTotals(day).kcal, dailyKcalTarget) : 'none';
        const dot = DOT_CLASS[status];
        const active = dayOfWeek === current;
        // Like the week view's headers: a past day carries a lock, today a pill (client plans only).
        const past = locks ? isPastDay(locks, week.weekNumber, dayOfWeek) : false;
        const today = locks ? isToday(locks, week.weekNumber, dayOfWeek) : false;
        return (
          <button
            key={dayOfWeek}
            type="button"
            role="tab"
            aria-selected={active}
            data-status={status}
            onClick={() => onSelect(dayOfWeek)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
            )}
          >
            {t(`planEditor.days.${dayOfWeek}`)}
            {past && (
              <Lock
                data-testid="day-tab-lock"
                className="size-3"
                role="img"
                aria-label={t('planEditor.locks.dayLocked', { day: t(`planEditor.daysLong.${dayOfWeek}`) })}
              />
            )}
            {today && (
              <span data-testid="day-tab-today" className="text-meta font-semibold">
                {'· '}
                {t('planEditor.locks.today')}
              </span>
            )}
            {conflicts && weekIndex !== undefined && conflicts.countOnDay(weekIndex, dayOfWeek) > 0 && <ConflictBadge />}
            {dot && <span className={cn('size-1.75 rounded-full', dot)} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
