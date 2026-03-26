import { type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/react';
import type { DragData } from './dnd-types';

interface DraggableSessionProps {
  weekNumber: number;
  sessionId: string;
  dayOfWeek: number;
  children: ReactNode;
}

/// Draggable handle wrapper for a session header. Allows moving sessions between days/weeks.
export default function DraggableSession({
  weekNumber,
  sessionId,
  dayOfWeek,
  children,
}: DraggableSessionProps) {
  const data: DragData = {
    type: 'session',
    weekNumber,
    sessionId,
    dayOfWeek,
  };

  const { ref, isDragSource } = useDraggable({
    id: `session-drag-${sessionId}`,
    type: 'session',
    data,
  });

  return (
    <div
      ref={ref}
      className={`transition-all duration-200 ${isDragSource ? 'opacity-40 scale-95' : ''}`}
    >
      {children}
    </div>
  );
}
