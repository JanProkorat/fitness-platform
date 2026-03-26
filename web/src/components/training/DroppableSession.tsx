import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/react';
import { sessionDropId } from './dnd-types';

interface DroppableSessionProps {
  sessionId: string;
  dayOfWeek: number;
  children: ReactNode;
}

/// Droppable container for a training session. Accepts exercises (cross-session move)
/// and sessions (reorder within day).
export default function DroppableSession({ sessionId, dayOfWeek, children }: DroppableSessionProps) {
  const { ref, isDropTarget } = useDroppable({
    id: sessionDropId(sessionId),
    data: { type: 'session-container', sessionId, dayOfWeek },
    accept: ['exercise'],
  });

  return (
    <div
      ref={ref}
      data-session-id={sessionId}
      className={`flex flex-col gap-1.5 p-2 transition-colors duration-200 ${
        isDropTarget ? 'bg-gold/5 rounded-sm' : ''
      }`}
    >
      {children}
    </div>
  );
}
