import type { CSSProperties } from 'react';
import { useDragOperation, useDroppable, type UseDroppableInput } from '@dnd-kit/react';
import { cn } from '@/lib/utils';
import { MEAL_GAP_DROP, readCellMealDrag } from '@/components/plan-editor/plan-editor-library';

/** Collision priority above every cell's, so a pointer inside a gap picks the gap. */
const GAP_COLLISION_PRIORITY = 4;
/** The library's code for a pointer-inside-shape collision. */
const POINTER_COLLISION_TYPE = 2;

/** A gap only collides while the pointer is inside it; the dragged card's overlap alone never picks it. */
const pointerInsideGap: NonNullable<UseDroppableInput['collisionDetector']> = ({ dragOperation, droppable }) => {
  const pointer = dragOperation.position.current;
  if (!pointer || !droppable.shape?.containsPoint(pointer)) {
    return null;
  }
  return { id: droppable.id, value: 1, type: POINTER_COLLISION_TYPE, priority: GAP_COLLISION_PRIORITY };
};

interface Props {
  weekIndex: number;
  dayOfWeek: number;
  /** The gap sits before the day's slot with this index; the meal count for the gap after the last one. */
  gapIndex: number;
  /** The day's meal ids in the order the day runs. */
  slotMealIds: readonly string[];
  /** The gap lies above the (relative) parent by default; `below` puts it under it instead. */
  edge?: 'above' | 'below';
  className?: string;
  style?: CSSProperties;
}

/**
 * A drop target in the 12px gap beside a meal card, live only while a meal of the same week and day is
 * dragged. Dropping there moves the dragged meal's contents to that position. The gaps next to the dragged
 * meal itself would change nothing, so they stay off. Absolutely positioned, so it moves nothing.
 */
export default function MealGapDropTarget({
  weekIndex,
  dayOfWeek,
  gapIndex,
  slotMealIds,
  edge = 'above',
  className,
  style,
}: Props) {
  const { source } = useDragOperation();
  const dragged = readCellMealDrag(source?.data);
  const fromIndex = dragged ? slotMealIds.indexOf(dragged.mealId) : -1;
  const active =
    dragged !== null &&
    dragged.weekIndex === weekIndex &&
    dragged.dayOfWeek === dayOfWeek &&
    fromIndex !== -1 &&
    gapIndex !== fromIndex &&
    gapIndex !== fromIndex + 1;
  const { ref, isDropTarget } = useDroppable({
    id: `meal-gap:${weekIndex}:${dayOfWeek}:${gapIndex}`,
    data: { type: MEAL_GAP_DROP, weekIndex, dayOfWeek, gapIndex },
    disabled: !active,
    collisionDetector: pointerInsideGap,
    collisionPriority: GAP_COLLISION_PRIORITY,
  });

  if (!active) {
    return null;
  }
  return (
    <span
      ref={ref}
      data-testid="meal-gap"
      data-day={dayOfWeek}
      data-gap={gapIndex}
      data-over={isDropTarget ? 'true' : undefined}
      aria-hidden="true"
      style={style}
      className={cn(
        'absolute inset-x-0 z-20 flex h-3 items-center',
        edge === 'above' ? '-top-3' : '-bottom-3',
        className,
      )}
    >
      <span
        data-testid="meal-gap-indicator"
        className={cn('h-0.5 w-full rounded-full bg-primary', isDropTarget ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  );
}
