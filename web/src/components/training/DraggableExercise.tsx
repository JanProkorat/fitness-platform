import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import type { DragData } from './dnd-types';
import type { SessionExercise } from '@/api/training-plan-types';

interface DraggableExerciseProps {
  weekNumber: number;
  sessionId: string;
  exerciseIndex: number;
  exercise: SessionExercise;
  children: ReactNode;
}

/// Sortable wrapper for an exercise item within a session.
export default function DraggableExercise({
  weekNumber,
  sessionId,
  exerciseIndex,
  exercise,
  children,
}: DraggableExerciseProps) {
  const data: DragData = {
    type: 'exercise',
    weekNumber,
    sessionId,
    exerciseIndex,
    exercise,
  };

  const { ref, isDragSource } = useSortable({
    id: `exercise-${sessionId}-${exerciseIndex}-${exercise.exerciseExternalId}`,
    index: exerciseIndex,
    group: sessionId,
    type: 'exercise',
    data,
  });

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-200 ${isDragSource ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}
