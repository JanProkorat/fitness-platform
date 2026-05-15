import React, { useState } from 'react';

interface SessionDragWrapperProps {
  sessionId: string;
  selectedDay: number;
  selectedWeek: number;
  children: React.ReactNode;
  /** When true, drag-out and drop-over are both rejected — the session
   *  can't be reordered out of, and another session can't be dropped in
   *  front of it. Use for read-only views (finished session, past day). */
  disabled?: boolean;
}

/** Draggable session wrapper — mirrors SortableMealItem from the nutrition plan. */
export function SessionDragWrapper({
  sessionId, selectedDay, selectedWeek, children, disabled,
}: SessionDragWrapperProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      draggable={!disabled}
      onDragStart={disabled ? undefined : (e) => {
        e.dataTransfer.setData('application/session-json', JSON.stringify({ type: 'session', sessionId, fromDay: selectedDay, fromWeek: selectedWeek }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (disabled) return;
        if (e.dataTransfer.types.includes('application/session-json')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (disabled) return;
        if (!e.dataTransfer.types.includes('application/session-json')) return;
        e.preventDefault();
        // reorder handled by parent container
      }}
      data-session-id={sessionId}
      className="mb-4"
      style={{
        borderTop: over ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
    >
      {children}
    </div>
  );
}

export default SessionDragWrapper;
