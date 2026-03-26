import { type ReactNode, useCallback, useRef, useState, useMemo } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/dom';
import { useTrainingPlanStore } from '@/stores/trainingPlan';
import type { DragData } from './dnd-types';
import TrainingDragOverlay from './TrainingDragOverlay';
import { TrainingDragContext, type SessionDropIndicator, type ExerciseDropIndicator } from './TrainingDragContext';

interface TrainingDragProviderProps {
  children: ReactNode;
  onCopyDayDialog: (fromWeek: number, fromDay: number, toWeek: number, toDay: number) => void;
}

/// DragDropProvider wrapper that routes drag events to store actions and tracks
/// session drop indicator position via pointer-vs-session-element geometry.
export default function TrainingDragProvider({ children, onCopyDayDialog }: TrainingDragProviderProps) {
  const store = useTrainingPlanStore;
  const [sessionIndicator, setSessionIndicator] = useState<SessionDropIndicator | null>(null);
  const sessionIndicatorRef = useRef<SessionDropIndicator | null>(null);
  const [exerciseIndicator, setExerciseIndicator] = useState<ExerciseDropIndicator | null>(null);
  const exerciseIndicatorRef = useRef<ExerciseDropIndicator | null>(null);
  const [dayGapIndicator, setDayGapIndicator] = useState<number | null>(null);
  const dayGapRef = useRef<number | null>(null);

  // Stash drag data at drag start so it survives DOM re-mounts (week switch).
  const activeDragRef = useRef<DragData | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const source = event.operation.source;
    if (source) {
      activeDragRef.current = source.data as DragData;
    }
  }, []);

  // Clear a specific indicator type
  const clearSessionIndicator = () => {
    if (sessionIndicatorRef.current !== null) {
      sessionIndicatorRef.current = null;
      setSessionIndicator(null);
    }
  };
  const clearExerciseIndicator = () => {
    if (exerciseIndicatorRef.current !== null) {
      exerciseIndicatorRef.current = null;
      setExerciseIndicator(null);
    }
  };
  const clearDayGapIndicator = () => {
    if (dayGapRef.current !== null) {
      dayGapRef.current = null;
      setDayGapIndicator(null);
    }
  };

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { operation } = event;
    const dragData = activeDragRef.current;
    if (!dragData) {
      clearSessionIndicator();
      clearExerciseIndicator();
      clearDayGapIndicator();
      return;
    }

    const pointerY = operation.position.current.y;
    const pointerX = operation.position.current.x;

    if (dragData.type === 'session') {
      clearExerciseIndicator();
      clearDayGapIndicator();
      updateSessionIndicator(pointerX, pointerY);
    } else if (dragData.type === 'exercise') {
      clearSessionIndicator();
      clearDayGapIndicator();
      updateExerciseIndicator(pointerX, pointerY);
    } else if (dragData.type === 'day') {
      clearSessionIndicator();
      clearExerciseIndicator();
      updateDayGapIndicator(pointerX, dragData.dayOfWeek);
    } else {
      clearSessionIndicator();
      clearExerciseIndicator();
      clearDayGapIndicator();
    }
  }, []);

  function updateSessionIndicator(pointerX: number, pointerY: number) {
    let targetDay: number | null = null;
    const dayCols = document.querySelectorAll<HTMLElement>('[data-day]');
    for (const col of dayCols) {
      const rect = col.getBoundingClientRect();
      if (pointerX >= rect.left && pointerX <= rect.right) {
        targetDay = Number(col.dataset.day);
        break;
      }
    }

    if (targetDay == null) {
      clearSessionIndicator();
      return;
    }

    const sessionEls = document.querySelectorAll<HTMLElement>(`[data-day="${targetDay}"] [data-session-idx]`);
    let insertIndex = sessionEls.length;
    for (const el of sessionEls) {
      const rect = el.getBoundingClientRect();
      if (pointerY < rect.top + rect.height / 2) {
        insertIndex = Number(el.dataset.sessionIdx);
        break;
      }
    }

    const prev = sessionIndicatorRef.current;
    if (!prev || prev.dayOfWeek !== targetDay || prev.insertIndex !== insertIndex) {
      const next = { dayOfWeek: targetDay, insertIndex };
      sessionIndicatorRef.current = next;
      setSessionIndicator(next);
    }
  }

  function updateExerciseIndicator(pointerX: number, pointerY: number) {
    // Find which session container the pointer is over
    const sessionContainers = document.querySelectorAll<HTMLElement>('[data-session-id]');
    let targetSessionId: string | null = null;
    for (const el of sessionContainers) {
      const rect = el.getBoundingClientRect();
      if (pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom) {
        targetSessionId = el.dataset.sessionId!;
        break;
      }
    }

    if (targetSessionId == null) {
      clearExerciseIndicator();
      return;
    }

    const exerciseEls = document.querySelectorAll<HTMLElement>(`[data-session-id="${targetSessionId}"] [data-exercise-idx]`);
    let insertIndex = exerciseEls.length;
    for (const el of exerciseEls) {
      const rect = el.getBoundingClientRect();
      if (pointerY < rect.top + rect.height / 2) {
        insertIndex = Number(el.dataset.exerciseIdx);
        break;
      }
    }

    const prev = exerciseIndicatorRef.current;
    if (!prev || prev.sessionId !== targetSessionId || prev.insertIndex !== insertIndex) {
      const next = { sessionId: targetSessionId, insertIndex };
      exerciseIndicatorRef.current = next;
      setExerciseIndicator(next);
    }
  }

  function updateDayGapIndicator(pointerX: number, draggedDay: number) {
    // Check gaps between day columns. A gap is the zone between two [data-day] elements.
    // Gap position N means "insert before day N" (1 = before day 1, 8 = after day 7).
    const dayCols = Array.from(document.querySelectorAll<HTMLElement>('[data-day]'))
      .sort((a, b) => Number(a.dataset.day) - Number(b.dataset.day));

    if (dayCols.length === 0) { clearDayGapIndicator(); return; }

    const GAP_ZONE = 20; // px from edge of column that counts as "gap zone"
    let gapPosition: number | null = null;

    for (let i = 0; i < dayCols.length; i++) {
      const col = dayCols[i];
      const rect = col.getBoundingClientRect();
      const dayNum = Number(col.dataset.day);

      // Left edge gap: before this column
      if (pointerX < rect.left + GAP_ZONE && pointerX >= rect.left - GAP_ZONE) {
        // Don't show gap adjacent to dragged day (no-op positions)
        if (dayNum !== draggedDay && dayNum !== draggedDay + 1) {
          gapPosition = dayNum;
        }
        break;
      }

      // Right edge gap: after this column (only for last column)
      if (i === dayCols.length - 1 && pointerX > rect.right - GAP_ZONE && pointerX <= rect.right + GAP_ZONE) {
        if (dayNum !== draggedDay && dayNum + 1 !== draggedDay) {
          gapPosition = dayNum + 1;
        }
        break;
      }

      // Between this column and the next
      if (i < dayCols.length - 1) {
        const nextRect = dayCols[i + 1].getBoundingClientRect();
        const gapCenter = (rect.right + nextRect.left) / 2;
        if (pointerX >= rect.right - GAP_ZONE && pointerX <= nextRect.left + GAP_ZONE) {
          const pos = dayNum + 1;
          // Skip no-op positions (adjacent to source)
          if (pos !== draggedDay && pos !== draggedDay + 1) {
            gapPosition = pos;
          }
          break;
        }
      }
    }

    if (dayGapRef.current !== gapPosition) {
      dayGapRef.current = gapPosition;
      setDayGapIndicator(gapPosition);
    }
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { operation, canceled } = event;

    // Capture stashed data + indicators before clearing
    const dragData = activeDragRef.current;
    const lastSessionIndicator = sessionIndicatorRef.current;
    const lastExerciseIndicator = exerciseIndicatorRef.current;
    const lastDayGap = dayGapRef.current;
    activeDragRef.current = null;
    sessionIndicatorRef.current = null;
    exerciseIndicatorRef.current = null;
    dayGapRef.current = null;
    setSessionIndicator(null);
    setExerciseIndicator(null);
    setDayGapIndicator(null);

    if (canceled || !dragData) return;

    const state = store.getState();
    const selectedWeek = state.selectedWeek;

    // Resolve drop target: prefer dnd-kit's target, fall back to pointer-based resolution
    const target = operation.target;
    const dropData = target?.data as Record<string, unknown> | undefined;

    // Skip week tab drops — tabs are navigation triggers, not drop targets
    if (dropData?.type === 'week-tab') return;

    if (dragData.type === 'exercise') {
      handleExerciseDrop(dragData, lastExerciseIndicator, dropData, selectedWeek, state);
    } else if (dragData.type === 'session') {
      const targetDayOfWeek = (dropData?.dayOfWeek as number | undefined) ?? lastSessionIndicator?.dayOfWeek;
      if (targetDayOfWeek == null) return;
      const insertIndex = lastSessionIndicator?.dayOfWeek === targetDayOfWeek ? lastSessionIndicator.insertIndex : undefined;
      handleSessionDrop(dragData, targetDayOfWeek, insertIndex, selectedWeek, state);
    } else if (dragData.type === 'day') {
      // Gap drop = reorder within same week
      if (lastDayGap != null && dragData.weekNumber === selectedWeek) {
        state.reorderDay(selectedWeek, dragData.dayOfWeek, lastDayGap);
        return;
      }
      // Column drop = copy
      const targetDayOfWeek = resolveTargetDay(dropData, operation);
      if (targetDayOfWeek == null) return;
      handleDayDrop(dragData, targetDayOfWeek, selectedWeek, state, onCopyDayDialog);
    }
  }, [store, onCopyDayDialog]);

  const contextValue = useMemo(
    () => ({ sessionIndicator, exerciseIndicator, dayGapIndicator }),
    [sessionIndicator, exerciseIndicator, dayGapIndicator],
  );

  return (
    <TrainingDragContext.Provider value={contextValue}>
      <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragMove={handleDragMove}>
        {children}
        <TrainingDragOverlay />
      </DragDropProvider>
    </TrainingDragContext.Provider>
  );
}

/// Resolve the target day-of-week from the dnd-kit target data, or fall back to
/// pointer position over [data-day] elements (needed when DOM re-mounted after week switch).
function resolveTargetDay(
  dropData: Record<string, unknown> | undefined,
  operation: { position: { current: { x: number; y: number } } },
): number | null {
  if (dropData?.dayOfWeek != null) {
    return dropData.dayOfWeek as number;
  }
  // Pointer-based fallback
  const pointerX = operation.position.current.x;
  const dayCols = document.querySelectorAll<HTMLElement>('[data-day]');
  for (const col of dayCols) {
    const rect = col.getBoundingClientRect();
    if (pointerX >= rect.left && pointerX <= rect.right) {
      return Number(col.dataset.day);
    }
  }
  return null;
}

function handleExerciseDrop(
  drag: Extract<DragData, { type: 'exercise' }>,
  indicator: ExerciseDropIndicator | null,
  drop: Record<string, unknown> | undefined,
  selectedWeek: number,
  state: ReturnType<typeof useTrainingPlanStore.getState>,
) {
  // Resolve target session + index from indicator (pointer-based) or dnd-kit drop data
  const targetSessionId = indicator?.sessionId ?? (drop?.sessionId as string | undefined);
  if (!targetSessionId) return;
  const targetIndex = indicator?.insertIndex
    ?? (typeof drop?.index === 'number' ? drop.index : getSessionExerciseCount(state, selectedWeek, targetSessionId));

  const sourceWeek = drag.weekNumber;
  const targetWeek = selectedWeek;

  if (sourceWeek !== targetWeek) {
    state.moveExerciseToWeek(sourceWeek, targetWeek, drag.sessionId, targetSessionId, drag.exerciseIndex, targetIndex);
  } else if (drag.sessionId === targetSessionId) {
    let adjustedTarget = targetIndex;
    // When reordering within the same session, account for the removed source
    if (drag.exerciseIndex < adjustedTarget) adjustedTarget--;
    if (drag.exerciseIndex !== adjustedTarget) {
      state.reorderExercises(selectedWeek, drag.sessionId, drag.exerciseIndex, adjustedTarget);
    }
  } else {
    state.moveExerciseToSession(selectedWeek, drag.sessionId, targetSessionId, drag.exerciseIndex, targetIndex);
  }
}

function handleSessionDrop(
  drag: Extract<DragData, { type: 'session' }>,
  targetDayOfWeek: number,
  insertIndex: number | undefined,
  selectedWeek: number,
  state: ReturnType<typeof useTrainingPlanStore.getState>,
) {
  const sourceWeek = drag.weekNumber;
  const targetWeek = selectedWeek;

  if (sourceWeek !== targetWeek) {
    state.moveSessionToWeek(sourceWeek, targetWeek, drag.sessionId, targetDayOfWeek, insertIndex);
  } else if (drag.dayOfWeek !== targetDayOfWeek || insertIndex != null) {
    state.moveSessionToDay(selectedWeek, drag.sessionId, targetDayOfWeek, insertIndex);
  }
}

function handleDayDrop(
  drag: Extract<DragData, { type: 'day' }>,
  targetDayOfWeek: number,
  selectedWeek: number,
  state: ReturnType<typeof useTrainingPlanStore.getState>,
  onCopyDayDialog: (fromWeek: number, fromDay: number, toWeek: number, toDay: number) => void,
) {
  const sourceWeek = drag.weekNumber;
  const targetWeek = selectedWeek;

  // Same week + same day = no-op
  if (sourceWeek === targetWeek && drag.dayOfWeek === targetDayOfWeek) return;

  // Check if the target day already has sessions
  const targetWeekData = state.plan?.weeks.find((w) => w.weekNumber === targetWeek);
  const targetHasSessions = targetWeekData?.sessions.some((s) => s.dayOfWeek === targetDayOfWeek) ?? false;

  if (targetHasSessions) {
    onCopyDayDialog(sourceWeek, drag.dayOfWeek, targetWeek, targetDayOfWeek);
  } else if (sourceWeek !== targetWeek) {
    state.copyDayToWeek(sourceWeek, drag.dayOfWeek, targetWeek, targetDayOfWeek);
  } else {
    state.copyDayToDay(sourceWeek, drag.dayOfWeek, targetDayOfWeek);
  }
}

function getSessionExerciseCount(
  state: ReturnType<typeof useTrainingPlanStore.getState>,
  weekNumber: number,
  sessionId: string,
): number {
  const week = state.plan?.weeks.find((w) => w.weekNumber === weekNumber);
  const session = week?.sessions.find((s) => s.sessionId === sessionId);
  return session?.exercises.length ?? 0;
}
