import { useTranslation } from 'react-i18next';
import type { MovementType, WorkoutFormat } from '@/api/training-plan-types';

const MOVEMENT_TYPES: MovementType[] = ['Reps', 'Time', 'Distance', 'RepsForTime'];

interface MovementTypePillProps {
  value: MovementType;
  onChange: (value: MovementType) => void;
  disabled?: boolean;
  /**
   * Section format. When set, the picker may hide movement types that
   * don't compose well with this format (e.g. Tabata's fixed work window
   * is incompatible with "reps for time" — both pin the time budget, so
   * the combination is contradictory).
   */
  sectionFormat?: WorkoutFormat;
}

/**
 * Inline pill-style picker for selecting an exercise's MovementType.
 * Renders as a compact dropdown on the exercise card header.
 */
export function MovementTypePill({ value, onChange, disabled, sectionFormat }: MovementTypePillProps) {
  const { t } = useTranslation();

  // Per-format compatibility table. Each section format restricts the
  // movement-type set to combinations that semantically compose:
  //
  //   Standard  → Reps, Time, Distance, RepsForTime  (all valid)
  //   EMOM      → Reps, Time, Distance, RepsForTime  (all valid)
  //   AMRAP     → Reps, Time, Distance               — AMRAP already
  //               means "race the time cap"; RepsForTime contradicts the
  //               AMRAP "max rounds" goal.
  //   Tabata    → Reps, Distance                     — Tabata fixes the
  //               work window; Time and RepsForTime both re-prescribe
  //               the time budget the section already owns.
  //   ForTime   → Reps, Time, Distance, RepsForTime  (all valid)
  //
  // Edge case: legacy plans may already carry a now-disallowed value
  // (e.g. RepsForTime inside Tabata). Keep that specific value in the
  // list so the <select> doesn't render an empty selection — the
  // trainer can still see what was set and switch to a valid type.
  const allowedByFormat: Record<WorkoutFormat, MovementType[]> = {
    Standard: ['Reps', 'Time', 'Distance', 'RepsForTime'],
    EMOM: ['Reps', 'Time', 'Distance', 'RepsForTime'],
    AMRAP: ['Reps', 'Time', 'Distance'],
    Tabata: ['Reps', 'Distance'],
    ForTime: ['Reps', 'Time', 'Distance', 'RepsForTime'],
  };
  const allowed = sectionFormat
    ? allowedByFormat[sectionFormat] ?? MOVEMENT_TYPES
    : MOVEMENT_TYPES;
  const options = MOVEMENT_TYPES.filter(
    (mt) => allowed.includes(mt) || mt === value,
  );

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MovementType)}
        aria-label={t('training.movementTypeAriaLabel')}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg2)',
          color: 'var(--text3)',
          fontSize: 10,
          fontFamily: 'inherit',
          fontWeight: 500,
          padding: '1px 14px 1px 5px',
          cursor: disabled ? 'default' : 'pointer',
          outline: 'none',
          lineHeight: '16px',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-hv)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        {options.map((mt) => (
          <option key={mt} value={mt}>
            {t(`training.movementType.${mt.charAt(0).toLowerCase() + mt.slice(1)}`)}
          </option>
        ))}
      </select>
      {/* Chevron indicator */}
      <span
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 8,
          color: 'var(--text4)',
          pointerEvents: 'none',
        }}
      >
        ▾
      </span>
    </div>
  );
}
