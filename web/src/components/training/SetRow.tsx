import { useTranslation } from 'react-i18next';
import type { ExerciseSet, MovementType } from '@/api/training-plan-types';

interface SetRowProps {
  set: ExerciseSet;
  movementType: MovementType;
  onUpdate: (updates: Partial<ExerciseSet>) => void;
  onRemove: () => void;
}

/**
 * A single row in the set table.
 * Columns rendered depend on the parent exercise's movementType:
 *   Reps        → weight + reps + rest
 *   Time        → duration + rest
 *   Distance    → distance + duration + rest
 *   RepsForTime → reps + rest
 */
export function SetRow({ set, movementType, onUpdate, onRemove }: SetRowProps) {
  const { t } = useTranslation();

  // Shared input styling (keeps the same look as the original inline inputs).
  const inputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--text)',
    fontFamily: 'inherit',
    padding: '2px 6px',
    borderRadius: 'var(--radius)',
    textAlign: 'right' as const,
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

  const columnCount = movementType === 'Distance' ? 3 : 2;
  const gridCols =
    movementType === 'Distance'
      ? '28px 90px 72px 90px 20px'
      : '28px 1fr 68px 68px 90px 20px';

  return (
    <div
      className="grid gap-2 mb-[2px] group/set items-center"
      style={{ gridTemplateColumns: columnCount === 3 ? '28px 1fr 1fr 90px 20px' : gridCols }}
    >
      <span className="text-center text-[11px] font-mono text-text4 self-center">
        {set.setNumber}
      </span>

      {renderColumns()}

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
          opacity: 0,
        }}
        className="group-hover/set:!opacity-100"
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
  );
}
