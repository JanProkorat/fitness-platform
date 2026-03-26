import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/react';
import { weekTabDropId } from './dnd-types';
import type { WeekTabRenderProps } from '@/components/nutrition/WeekSelector';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import { useDragOperation } from '@dnd-kit/react';

const statusBadgeClass: Record<'Draft' | 'Published', string> = {
  Draft: 'bg-yellow-500/15 text-yellow-400',
  Published: 'bg-green-500/15 text-green-400',
};

/// Week tab with droppable behavior and 500ms hover-switch for cross-week DnD.
export default function WeekTab({ weekNumber, status, isSelected }: WeekTabRenderProps) {
  const { t } = useTranslation();
  const setSelectedWeek = useTrainingPlanStore((s) => s.setSelectedWeek);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { source } = useDragOperation();
  const isDragging = source != null;

  const { ref, isDropTarget } = useDroppable({
    id: weekTabDropId(weekNumber),
    data: { type: 'week-tab', weekNumber },
    disabled: isSelected || !isDragging,
  });

  // 500ms hover-switch: when drag hovers over this tab, switch week after delay
  useEffect(() => {
    if (isDropTarget && !isSelected && isDragging) {
      timerRef.current = setTimeout(() => {
        setSelectedWeek(weekNumber);
      }, 500);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDropTarget, isSelected, isDragging, weekNumber, setSelectedWeek]);

  const handleClick = useCallback(() => {
    if (!isDragging) setSelectedWeek(weekNumber);
  }, [isDragging, weekNumber, setSelectedWeek]);

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className={`relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-sm px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide transition-colors ${
        isSelected
          ? 'bg-gold/15 text-gold'
          : isDropTarget && isDragging
            ? 'bg-gold/10 text-gold'
            : 'text-text3 hover:text-text2'
      }`}
    >
      <span>{t('nutrition.weekLabel', { number: weekNumber })}</span>
      <span
        className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal ${statusBadgeClass[status]}`}
      >
        {status === 'Draft' ? t('nutrition.weekDraft') : t('nutrition.weekPublished')}
      </span>
      {/* Progress bar animation during hover-switch countdown */}
      {isDropTarget && isDragging && !isSelected && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-gold"
          style={{ animation: 'dndTabProgress 500ms linear forwards' }}
        />
      )}
    </button>
  );
}
