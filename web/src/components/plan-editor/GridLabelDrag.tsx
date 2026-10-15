import type { ReactNode } from 'react';
import { useDragOperation, useDraggable, useDroppable, type UseDroppableInput } from '@dnd-kit/react';
import { cn } from '@/lib/utils';
import {
  DAY_LABEL_DRAG,
  DAY_LABEL_DROP,
  DAY_LABEL_KEY_SHORTCUTS,
  LABEL_SENSORS,
  moveDirection,
  readDayLabel,
  readRowLabel,
  ROW_LABEL_DRAG,
  ROW_LABEL_DROP,
  ROW_LABEL_KEY_SHORTCUTS,
  sideDirection,
} from '@/components/plan-editor/plan-editor-library';
import type { LabelAxis } from '@/components/plan-editor/plan-editor-ops';

/** Collision priority above every cell's, so a pointer inside a label picks it. */
const LABEL_COLLISION_PRIORITY = 4;
/** The library's code for a pointer-inside-shape collision. */
const POINTER_COLLISION_TYPE = 2;

/** A label only collides while the pointer is inside it; the dragged chip's overlap alone never picks it. */
const pointerInsideLabel: NonNullable<UseDroppableInput['collisionDetector']> = ({ dragOperation, droppable }) => {
  const pointer = dragOperation.position.current;
  if (!pointer || !droppable.shape?.containsPoint(pointer)) {
    return null;
  }
  return { id: droppable.id, value: 1, type: POINTER_COLLISION_TYPE, priority: LABEL_COLLISION_PRIORITY };
};

interface LabelProps {
  axis: LabelAxis;
  weekIndex: number;
  /** The row index of a row label, the weekday (1-7) of a day label. */
  index: number;
}

function dragData({ axis, weekIndex, index }: LabelProps) {
  return axis === 'row'
    ? { type: ROW_LABEL_DRAG, weekIndex, rowIndex: index }
    : { type: DAY_LABEL_DRAG, weekIndex, dayOfWeek: index };
}

function dropData({ axis, weekIndex, index }: LabelProps) {
  return axis === 'row'
    ? { type: ROW_LABEL_DROP, weekIndex, rowIndex: index }
    : { type: DAY_LABEL_DROP, weekIndex, dayOfWeek: index };
}

/** The index of the label of this axis being dragged in this week, or null. */
function draggedIndex(axis: LabelAxis, weekIndex: number, data: unknown): number | null {
  if (axis === 'row') {
    const row = readRowLabel(data, ROW_LABEL_DRAG);
    return row && row.weekIndex === weekIndex ? row.rowIndex : null;
  }
  const day = readDayLabel(data, DAY_LABEL_DRAG);
  return day && day.weekIndex === weekIndex ? day.dayOfWeek : null;
}

interface FrameProps extends LabelProps {
  className?: string;
  children: ReactNode;
}

/**
 * The drop zone of a label: the whole cell around it, live only while a label of the same kind from the same
 * week is dragged, and only while the pointer is inside it.
 */
export function LabelFrame({ axis, weekIndex, index, className, children }: FrameProps) {
  const { source } = useDragOperation();
  const dragged = draggedIndex(axis, weekIndex, source?.data);
  const active = dragged !== null && dragged !== index;
  const { ref, isDropTarget } = useDroppable({
    id: `${axis}-label-drop:${weekIndex}:${index}`,
    data: dropData({ axis, weekIndex, index }),
    disabled: !active,
    collisionDetector: pointerInsideLabel,
    collisionPriority: LABEL_COLLISION_PRIORITY,
  });
  return (
    <span
      ref={ref}
      data-testid={`${axis}-label-frame`}
      data-index={index}
      data-over={isDropTarget ? 'true' : undefined}
      className={cn(
        className,
        isDropTarget && 'rounded-xl bg-nutrition-soft outline-2 -outline-offset-2 outline-nutrition outline-dashed',
      )}
    >
      {children}
    </span>
  );
}

interface HandleProps extends LabelProps {
  /** Accessible name of the handle; starts with the visible label. */
  ariaLabel: string;
  /** Alt+Arrow on the focused handle: swaps with the neighbouring row (up/down) or day (left/right). */
  onKeyMove: (direction: -1 | 1) => void;
  children: ReactNode;
}

/** The part of a label that drags and takes focus: just the text, so the buttons beside it keep working. */
export function LabelHandle({ axis, weekIndex, index, ariaLabel, onKeyMove, children }: HandleProps) {
  const { ref, isDragging } = useDraggable({
    id: `${axis}-label:${weekIndex}:${index}`,
    data: dragData({ axis, weekIndex, index }),
    sensors: LABEL_SENSORS,
  });
  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      data-testid={`${axis}-label`}
      data-index={index}
      aria-label={ariaLabel}
      aria-keyshortcuts={axis === 'row' ? ROW_LABEL_KEY_SHORTCUTS : DAY_LABEL_KEY_SHORTCUTS}
      onKeyDown={(event) => {
        const direction = axis === 'row' ? moveDirection(event) : sideDirection(event);
        if (direction) {
          event.preventDefault();
          onKeyMove(direction);
        }
      }}
      className={cn(
        'cursor-grab rounded-md outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      {children}
    </span>
  );
}
