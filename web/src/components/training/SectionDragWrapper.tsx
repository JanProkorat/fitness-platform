import React, { useState } from 'react';

interface SectionDragWrapperProps {
  sessionId: string;
  sectionId: string;
  children: React.ReactNode;
  /** When true, drag-out and drop-over are both rejected — the section
   *  can't be reordered out of, and another section can't be dropped in
   *  front of it. Use for read-only views (finished session, past day). */
  disabled?: boolean;
}

/**
 * Native HTML5 drag wrapper for a section card. Mirrors `SessionDragWrapper`.
 * Because HTML5 dispatches `dragstart` from the deepest `draggable` ancestor,
 * marking the section card as `draggable` prevents the surrounding session
 * card from being grabbed when the user drags a section.
 *
 * Reorder logic lives on the parent's section-list container — see
 * `TrainingPlanPage.tsx`. This wrapper only emits the drag payload and
 * shows a top-border indicator when another section is being dragged over it.
 */
export function SectionDragWrapper({
  sessionId, sectionId, children, disabled,
}: SectionDragWrapperProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      draggable={!disabled}
      onDragStart={disabled ? undefined : (e) => {
        e.dataTransfer.setData(
          'application/section-json',
          JSON.stringify({ type: 'section', sessionId, sectionId }),
        );
        e.dataTransfer.effectAllowed = 'move';
        // Stop the parent SessionDragWrapper from also seeing this dragstart.
        e.stopPropagation();

        // Use the section header as the drag image so collapsed sections
        // ghost as a small pill instead of snapshotting the (still in DOM
        // but visually clipped) collapsed body.
        const headerEl = e.currentTarget.querySelector(
          '[data-section-drag-image]',
        ) as HTMLElement | null;
        if (headerEl) {
          const rect = headerEl.getBoundingClientRect();
          e.dataTransfer.setDragImage(
            headerEl,
            Math.max(0, e.clientX - rect.left),
            Math.max(0, e.clientY - rect.top),
          );
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        if (!e.dataTransfer.types.includes('application/section-json')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      data-section-id={sectionId}
      style={{
        borderTop: over ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'border-color 0.1s',
      }}
    >
      {children}
    </div>
  );
}

export default SectionDragWrapper;
