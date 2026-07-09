import { useTranslation } from 'react-i18next';
import type { ExerciseSet, MovementType, LoggedSetDto } from '@/api/training-plan-types';
import type { SetCompletionState } from '@/lib/completionState';
import { CompletionBadge } from '@/components/common/CompletionBadge';
import { parseNumericInput } from '@/lib/parseNumericInput';

interface SetRowProps {
  set: ExerciseSet;
  movementType: MovementType;
  onUpdate: (updates: Partial<ExerciseSet>) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
  /** Completion state for this set (additive display-only; omit to render nothing). */
  completionState?: SetCompletionState;
  /**
   * Logged-set actual + snapshot-planned values from the client's workout log.
   * When present, the set is rendered in read-view (Treatment B):
   *   - Actual value as the headline number
   *   - Snapshot-planned as a quiet "plán…" caption below
   *   - Gold accent change-indicator dot when isModified === true
   * When absent (no workout log for this set), the editable plan inputs render as normal.
   */
  loggedSet?: LoggedSetDto;
  /**
   * When true, the set is an extra set performed beyond the plan count
   * (actual only, no planned value). Shown in gold + "navíc" caption.
   */
  isExtraSet?: boolean;
}

/**
 * A single row in the set table.
 * Columns rendered depend on the parent exercise's movementType:
 *   Reps        → weight + reps + rest
 *   Time        → duration + rest
 *   Distance    → distance + duration + rest
 *   RepsForTime → reps + rest
 */
export function SetRow({ set, movementType, onUpdate, onDuplicate, onRemove, completionState, loggedSet, isExtraSet }: SetRowProps) {
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
    ariaLabel?: string,
    min = 0,
  ) => (
    <input
      type="number"
      placeholder={placeholder}
      value={value ?? ''}
      min={min}
      aria-label={ariaLabel}
      style={inputStyle}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const parsed = parseNumericInput(e.target.value, min);
        if (parsed !== undefined) onChange(parsed);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );

  /**
   * Renders a single value cell in "logged view" (Treatment B):
   *   - actual value as headline (gold if isExtraSet, else default text color)
   *   - snapshot-planned as a quiet "plán X" caption below (hidden for extra sets)
   *   - gold dot change indicator when isModified === true
   *
   * Returns null when both actual and planned are null (set not performed).
   */
  const loggedCell = (
    actual: number | null | undefined,
    planned: number | null | undefined,
    isModifiedField: boolean,
  ) => {
    const actualDisplay = actual != null ? String(actual) : '–';
    const plannedDisplay = planned != null ? String(planned) : null;
    return (
      <div className="flex flex-col items-center gap-0" style={{ minWidth: 0 }}>
        {/* Actual headline */}
        <span
          className={
            isExtraSet
              ? 'text-[12px] font-semibold text-accent tabular-nums'
              : 'text-[12px] font-semibold text-text tabular-nums'
          }
        >
          {actualDisplay}
          {isModifiedField && !isExtraSet && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-accent ml-[2px] align-middle"
              aria-label={t('training.completionState.modified')}
            />
          )}
        </span>
        {/* Snapshot-planned caption */}
        {!isExtraSet && plannedDisplay != null && (
          <span className="text-[9px] text-text4 tabular-nums leading-none">
            {t('training.completionState.plan')} {plannedDisplay}
          </span>
        )}
        {/* Extra-set "navíc" caption */}
        {isExtraSet && (
          <span className="text-[9px] text-accent tabular-nums leading-none">
            {t('training.completionState.navic')}
          </span>
        )}
      </div>
    );
  };

  // Determine grid template based on movementType.
  // Columns: # | type-specific fields | rest | remove
  const renderColumns = () => {
    // When loggedSet is present, render actual/planned overlay instead of editable inputs
    if (loggedSet) {
      switch (movementType) {
        case 'Time':
          return (
            <>
              {loggedCell(loggedSet.actualDurationSeconds, loggedSet.plannedDurationSeconds, loggedSet.isModified)}
              {/* Rest is plan-only — no logged "actual rest" in the contract */}
              {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
            </>
          );
        case 'Distance':
          return (
            <>
              {loggedCell(loggedSet.actualDistanceMeters, loggedSet.plannedDistanceMeters, loggedSet.isModified)}
              {loggedCell(loggedSet.actualDurationSeconds, loggedSet.plannedDurationSeconds, loggedSet.isModified)}
              {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
            </>
          );
        case 'RepsForTime':
          return (
            <>
              {loggedCell(loggedSet.actualReps, loggedSet.plannedReps, loggedSet.isModified)}
              {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
            </>
          );
        // Reps (default)
        default:
          return (
            <>
              {loggedCell(loggedSet.actualWeightKg, loggedSet.plannedWeightKg, loggedSet.isModified)}
              {loggedCell(loggedSet.actualReps, loggedSet.plannedReps, loggedSet.isModified)}
              {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
            </>
          );
      }
    }

    switch (movementType) {
      case 'Time':
        return (
          <>
            {numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v }), '--', t('training.setDurationAriaLabel', { setNumber: set.setNumber }), 1)}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
          </>
        );
      case 'Distance':
        return (
          <>
            {numInput(set.distanceMeters, (v) => onUpdate({ distanceMeters: v }), '--', t('training.setDistanceAriaLabel', { setNumber: set.setNumber }), 1)}
            {numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v }), '--', t('training.setDurationAriaLabel', { setNumber: set.setNumber }), 1)}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
          </>
        );
      case 'RepsForTime':
        return (
          <>
            {numInput(set.reps, (v) => onUpdate({ reps: v }), '--', t('training.setRepsAriaLabel', { setNumber: set.setNumber }), 1)}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
          </>
        );
      // Reps (default)
      default:
        return (
          <>
            {numInput(set.weightKg, (v) => onUpdate({ weightKg: v }), '--', t('training.setWeightAriaLabel', { setNumber: set.setNumber }))}
            {numInput(set.reps, (v) => onUpdate({ reps: v }), '--', t('training.setRepsAriaLabel', { setNumber: set.setNumber }), 1)}
            {numInput(set.restSeconds, (v) => onUpdate({ restSeconds: v }), '--', t('training.setRestAriaLabel', { setNumber: set.setNumber }))}
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
          aria-label={t('common.delete')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
