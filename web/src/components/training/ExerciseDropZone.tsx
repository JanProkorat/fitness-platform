import React, { useState } from 'react';

interface ExerciseDropZoneProps {
  sessionId: string;
  exerciseIds: string[];
  selectedWeek: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onCrossSessionMove: (fromSessionId: string, fromIndex: number, toIndex: number, fromWeek: number) => void;
  children: React.ReactNode;
}

/** Drop zone wrapping exercise rows — mirrors MealDropZone from the nutrition plan. */
export function ExerciseDropZone({
  sessionId, exerciseIds: _exerciseIds, selectedWeek, onReorder, onCrossSessionMove, children,
}: ExerciseDropZoneProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={{
        minHeight: 24,
        borderRadius: 'var(--radius)',
        transition: 'background 0.15s',
        background: over ? 'var(--accent-bg)' : undefined,
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/exercise-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!e.dataTransfer.types.includes('application/exercise-json')) return;
        e.preventDefault();
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/exercise-json'));
          if (data.type !== 'exercise') return;

          // Find target index from mouse position
          const container = e.currentTarget;
          const rows = Array.from(container.querySelectorAll('[data-item-id]'));
          let targetIndex = rows.length;
          for (let i = 0; i < rows.length; i++) {
            const rect = rows[i].getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              targetIndex = i;
              break;
            }
          }

          const fromWeek = data.fromWeek ?? selectedWeek;

          if (data.sessionId === sessionId && fromWeek === selectedWeek) {
            // Same session reorder
            const fromIndex = data.exerciseIndex;
            if (fromIndex !== targetIndex) {
              onReorder(fromIndex, targetIndex > fromIndex ? targetIndex - 1 : targetIndex);
            }
          } else {
            // Cross-session or cross-week move
            onCrossSessionMove(data.sessionId, data.exerciseIndex, targetIndex, fromWeek);
          }
        } catch { /* ignore */ }
      }}
    >
      {children}
    </div>
  );
}

export default ExerciseDropZone;
