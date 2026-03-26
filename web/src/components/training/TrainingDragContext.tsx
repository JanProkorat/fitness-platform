import { createContext, useContext } from 'react';

/// Position indicator for session drop target.
export interface SessionDropIndicator {
  dayOfWeek: number;
  insertIndex: number; // index among sessions in that day (0 = before first, n = after last)
}

/// Position indicator for exercise drop target.
export interface ExerciseDropIndicator {
  sessionId: string;
  insertIndex: number; // index among exercises in that session (0 = before first, n = after last)
}

export interface TrainingDragState {
  sessionIndicator: SessionDropIndicator | null;
  exerciseIndicator: ExerciseDropIndicator | null;
  /// Gap position (1–8) for day reorder indicator. 1 = before day 1, 2 = between day 1 & 2, etc.
  dayGapIndicator: number | null;
}

export const TrainingDragContext = createContext<TrainingDragState>({
  sessionIndicator: null,
  exerciseIndicator: null,
  dayGapIndicator: null,
});

export function useTrainingDrag() {
  return useContext(TrainingDragContext);
}
