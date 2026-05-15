import { useTranslation } from 'react-i18next';
import type { ExerciseSet, MovementType, WorkoutFormat } from '@/api/training-plan-types';

interface WodExerciseRowProps {
  /** The single set holding the WOD round prescription. */
  set: ExerciseSet;
  movementType: MovementType;
  /**
   * Section format. Used to suppress fields that the section's format-config
   * already covers — e.g. Tabata fixes work duration via `workSeconds`, so
   * per-exercise reps / time / distance targets are redundant.
   */
  sectionFormat: WorkoutFormat;
  /** Patches the single set in the store. */
  onUpdate: (updates: Partial<ExerciseSet>) => void;
}

/**
 * Inline labeled inputs for the WOD round prescription
 * (single set, no rest, no set number).
 *
 * Renders as a flex row of `<label>: [input] <unit>` groups so it sits
 * comfortably alongside the MovementType pill on the same line — no
 * column-header row needed for a single-row editor.
 *
 * Inputs by MovementType:
 *   Reps        → weight (kg) + reps
 *   Time        → duration (s)
 *   Distance    → distance (m) + duration (s)
 *   RepsForTime → reps
 */
export function WodExerciseRow({ set, movementType, sectionFormat, onUpdate }: WodExerciseRowProps) {
  const { t } = useTranslation();
  // Tabata sets work duration at the section level (`formatConfig.workSeconds`),
  // so per-exercise reps don't make sense — the trainer prescribes load and
  // movement; the rep count is whatever the client achieves in the work window.
  const hideReps = sectionFormat === 'Tabata';

  const inputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'var(--bg2)',
    fontSize: 12,
    color: 'var(--text)',
    fontFamily: 'inherit',
    padding: '2px 6px',
    borderRadius: 'var(--radius)',
    textAlign: 'right' as const,
    width: 56,
    transition: 'background 0.1s',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-active)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg2)';
  };

  const numInput = (
    value: number | null | undefined,
    onChange: (v: number | null) => void,
  ) => (
    <input
      type="number"
      placeholder="--"
      value={value ?? ''}
      style={inputStyle}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value !== '' ? Number(e.target.value) : null)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );

  const labelClass = 'text-[11px] font-medium text-text3 uppercase';
  const unitClass = 'text-[11px] text-text4';

  const fieldGroup = (label: string, input: React.ReactNode, unit?: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      {input}
      {unit && <span className={unitClass}>{unit}</span>}
    </span>
  );

  // Weight is rendered alongside time / distance / reps-for-time so the
  // trainer can prescribe weighted timed work (e.g. weighted plank,
  // kettlebell carry, weighted carries-for-time). It's always optional —
  // the validator never requires it.
  const weightField = fieldGroup(
    t('training.weightLabel'),
    numInput(set.weightKg, (v) => onUpdate({ weightKg: v })),
    'kg',
  );

  switch (movementType) {
    case 'Time':
      return (
        <div className="flex items-center gap-3 flex-wrap">
          {fieldGroup(
            t('training.wod.durationLabel'),
            numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v })),
            's',
          )}
          {weightField}
        </div>
      );
    case 'Distance':
      return (
        <div className="flex items-center gap-3 flex-wrap">
          {fieldGroup(
            t('training.wod.distanceLabel'),
            numInput(set.distanceMeters, (v) => onUpdate({ distanceMeters: v })),
            'm',
          )}
          {fieldGroup(
            t('training.wod.durationLabel'),
            numInput(set.durationSeconds, (v) => onUpdate({ durationSeconds: v })),
            's',
          )}
          {weightField}
        </div>
      );
    case 'RepsForTime':
      return (
        <div className="flex items-center gap-3 flex-wrap">
          {!hideReps &&
            fieldGroup(t('training.repsLabel'), numInput(set.reps, (v) => onUpdate({ reps: v })))}
          {weightField}
        </div>
      );
    // Reps (default)
    default:
      return (
        <div className="flex items-center gap-3 flex-wrap">
          {weightField}
          {!hideReps &&
            fieldGroup(t('training.repsLabel'), numInput(set.reps, (v) => onUpdate({ reps: v })))}
        </div>
      );
  }
}
