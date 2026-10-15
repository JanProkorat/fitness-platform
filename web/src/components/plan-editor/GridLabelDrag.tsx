import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/react';
import { cn } from '@/lib/utils';
import {
  DAY_LABEL_DRAG,
  DAY_LABEL_KEY_SHORTCUTS,
  LABEL_SENSORS,
  moveDirection,
  ROW_LABEL_DRAG,
  ROW_LABEL_KEY_SHORTCUTS,
  sideDirection,
} from '@/components/plan-editor/plan-editor-library';
import type { LabelAxis } from '@/components/plan-editor/plan-editor-ops';

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

interface FrameProps extends LabelProps {
  /** The pointer is over this label's band while another label of the same kind is dragged. */
  over?: boolean;
  className?: string;
  children: ReactNode;
}

/** The cell around a label: it lights up while it is the target of a label drag. */
export function LabelFrame({ axis, index, over = false, className, children }: FrameProps) {
  return (
    <span
      data-testid={`${axis}-label-frame`}
      data-index={index}
      data-over={over ? 'true' : undefined}
      className={cn(
        className,
        over && 'rounded-xl bg-nutrition-soft outline-2 -outline-offset-2 outline-nutrition outline-dashed',
      )}
    >
      {children}
    </span>
  );
}

interface HandleProps extends LabelProps {
  /** Accessible name of the handle; starts with the visible label. */
  ariaLabel: string;
  /** Alt+Arrow on the focused handle: moves onto the neighbouring row (up/down) or day (left/right). */
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
