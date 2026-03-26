import type { SessionExercise } from '@/api/training-plan-types';

/// Discriminated union for all draggable item data in the training plan DnD system.
export type DragData =
  | { type: 'exercise'; weekNumber: number; sessionId: string; exerciseIndex: number; exercise: SessionExercise }
  | { type: 'session'; weekNumber: number; sessionId: string; dayOfWeek: number }
  | { type: 'day'; weekNumber: number; dayOfWeek: number };

/// Drop target identifiers used for useDroppable.
export function exerciseDropId(sessionId: string, index: number) {
  return `exercise-${sessionId}-${index}`;
}

export function sessionDropId(sessionId: string) {
  return `session-drop-${sessionId}`;
}

export function dayDropId(dayOfWeek: number) {
  return `day-drop-${dayOfWeek}`;
}

export function weekTabDropId(weekNumber: number) {
  return `week-tab-${weekNumber}`;
}
