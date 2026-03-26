import { type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/react';
import type { DragData } from './dnd-types';

interface DraggableDayHeaderProps {
  weekNumber: number;
  dayOfWeek: number;
  children: ReactNode;
}

/// Draggable wrapper for the day column header. Allows copying days across weeks.
export default function DraggableDayHeader({
  weekNumber,
  dayOfWeek,
  children,
}: DraggableDayHeaderProps) {
  const data: DragData = {
    type: 'day',
    weekNumber,
    dayOfWeek,
  };

  const { ref, isDragSource } = useDraggable({
    id: `day-drag-${dayOfWeek}`,
    type: 'day',
    data,
  });

  return (
    <div
      ref={ref}
      className={`cursor-grab border-b border-border px-3 py-2.5 active:cursor-grabbing transition-opacity duration-200 ${
        isDragSource ? 'opacity-40' : ''
      }`}
    >
      {children}
    </div>
  );
}
