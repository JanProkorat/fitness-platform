import { useTranslation } from 'react-i18next';
import type { ExerciseSet, MovementType } from '@/api/training-plan-types';
import type { SetCompletionState } from '@/lib/completionState';
import { CompletionBadge } from '@/components/common/CompletionBadge';

interface SetRowProps {
  set: ExerciseSet;
  movementType: MovementType;
  onUpdate: (updates: Partial<ExerciseSet>) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
  /** Completion state for this set (additive display-only; omit to render nothing). */
  completionState?: SetCompletionState;
}

/**
 * A single row in the set table.
 * Columns rendered depend on the parent exercise's movementType:
 *   Reps        → weight + reps + rest
 *   Time        → duration + rest
 *   Distance    → distance + duration + rest
 *   RepsForTime → reps + rest
 */
export function SetRow({ set, movementType, onUpdate, onDuplicate, onRemove, completionState }: SetRowProps) {
  const { t } = useTranslation();

  // Shared input styling. Values are centered in their columns so that the
  // column header (also centered) sits visually directly above the value
  // regardless of how many digits the value has.
  const inputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--text)',
    fontFamily: 'inherit',
    padding: '2px 6px',
    borderRadius: 'var(--radius)',
    textAlign: 'center' as const,
    transition: 'background 0.1s',
    width: '100%',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-active)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'transparent';
  };

  const numInput = (
    value: number | null | undefined,
    onChange: (v: number | null) => void,
    placeholder = '--',
    title?: string,
  ) => (
    <input
      type="number"
      placeholder={placeholder}
      value={value ?? ''}
      title={title}
      style={inputStyle}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        onChange(e.target.value !== '' ? Number(e.target.value) : null)
      }
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );

  // Determine grid template based on movementType.
  // Columns: # | type-specific fields | rest | remove
  const renderColumns = () => {
    switch (movementType) {
      case 'Time':
        return (
          <>
            {numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v }), '--', t('training.wod.durationSeconds'))}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.restSecondsLabel'))}
          </>
        );
      case 'Distance':
        return (
          <>
            {numInput(set.distanceMeters, (v) => onUpdate({ distanceMeters: v }), '--', t('training.wod.distanceMeters'))}
            {numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v }), '--', t('training.wod.durationSeconds'))}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.restSecondsLabel'))}
          </>
        );
      case 'RepsForTime':
        return (
          <>
            {numInput(set.reps, (v) => onUpdate({ reps: v }), '--', t('training.repsLabel'))}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.restSecondsLabel'))}
          </>
        );
      // Reps (default)
      default:
        return (
          <>
            {numInput(set.weightKg, (v) => onUpdate({ weightKg: v }), '--', t('training.weightLabel'))}
            {numInput(set.reps, (v) => onUpdate({ reps: v }), '--', t('training.repsLabel'))}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.restSecondsLabel'))}
          </>
        );
    }
  };

  // Grid template:
  //   col 1: 28 px set #
  //   col 2: 1fr spacer (pushes the value columns to the right edge)
  //   cols 3..N-2: type-specific value columns
  //   last col: 44 px wide trailing column for duplicate + remove icon buttons
  // Total children = 1 (setNumber) + 1 (spacer) + value columns + 1 (actions).
  const valueCols =
    movementType === 'Distance'
      ? '90px 72px 90px'
      : movementType === 'Reps'
        ? '68px 68px 90px'
        : movementType === 'Time'
          ? '90px 90px'
          : '68px 90px'; // RepsForTime
  // The completion-badge column is always present in the grid (24 px) so the
  // action-button column stays aligned regardless of whether a badge renders.
  const gridCols = `28px 1fr ${valueCols} 24px 56px`;

  return (
    <div
      className="grid gap-2 mb-[2px] group/set items-center"
      style={{ gridTemplateColumns: gridCols }}
    >
      <span className="text-center text-[11px] font-mono text-text4 self-center">
        {set.setNumber}
      </span>

      {/* Explicit spacer for the 1fr column so the value columns line up with
          the header's value columns regardless of how many inputs the
          movement type renders. */}
      <span />

      {renderColumns()}

      {/* Completion badge — set-level indicator (Check / SkipForward / nothing). */}
      <div className="flex items-center justify-center">
        {completionState !== undefined && (
          <CompletionBadge kind="set" state={completionState} />
        )}
      </div>

      {/* Trailing actions: duplicate (⧉) + remove (✕). Both always visible —
          the small icons sit at low contrast (text4) and only intensify on
          hover, so the row stays calm while the affordances are discoverable. */}
      <div className="flex items-center justify-end gap-3">
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 12,
              color: 'var(--text4)',
              borderRadius: 'var(--radius)',
              transition: 'color 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text4)';
            }}
            title={t('training.duplicateSet')}
            aria-label={t('training.duplicateSet')}
          >
            ⧉
          </button>
        )}
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 11,
            color: 'var(--text4)',
            borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--red)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text4)';
          }}
          title={t('common.delete')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
