import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/react';
import { dayDropId } from './dnd-types';

interface DroppableDayProps {
  dayOfWeek: number;
  children: ReactNode;
}

/// Droppable wrapper for a day column. Accepts sessions (move to day) and days (copy).
export default function DroppableDay({ dayOfWeek, children }: DroppableDayProps) {
  const { ref, isDropTarget } = useDroppable({
    id: dayDropId(dayOfWeek),
    data: { type: 'day-column', dayOfWeek },
    accept: ['session', 'day'],
  });

  return (
    <div
      ref={ref}
      data-day={dayOfWeek}
      className={`flex w-[336px] shrink-0 flex-col rounded-sm border bg-surface transition-all duration-200 ease-out ${
        isDropTarget ? 'border-gold bg-gold/5 scale-[1.01]' : 'border-border scale-100'
      }`}
    >
      {children}
    </div>
  );
}
