import { useTranslation } from 'react-i18next';
import type { MovementType } from '@/api/training-plan-types';

const MOVEMENT_TYPES: MovementType[] = ['Reps', 'Time', 'Distance', 'RepsForTime'];

interface MovementTypePillProps {
  value: MovementType;
  onChange: (value: MovementType) => void;
  disabled?: boolean;
}

/**
 * Inline pill-style picker for selecting an exercise's MovementType.
 * Renders as a compact dropdown on the exercise card header.
 */
export function MovementTypePill({ value, onChange, disabled }: MovementTypePillProps) {
  const { t } = useTranslation();

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MovementType)}
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
        {MOVEMENT_TYPES.map((mt) => (
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
