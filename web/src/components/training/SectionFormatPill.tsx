import { useTranslation } from 'react-i18next';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';

const FORMATS: WorkoutFormat[] = ['Standard', 'EMOM', 'AMRAP', 'ForTime', 'Tabata'];

function defaultConfig(format: WorkoutFormat): WodConfig | null {
  switch (format) {
    case 'ForTime':
      return { timeCapSeconds: null };
    case 'AMRAP':
      return { timeCapSeconds: null, totalRounds: 0 };
    case 'EMOM':
      return { intervalSeconds: 60, totalRounds: null };
    case 'Tabata':
      return { workSeconds: 20, restSeconds: 10, totalRounds: 8 };
    default:
      return null;
  }
}

interface SectionFormatPillProps {
  format: WorkoutFormat;
  onFormatChange: (format: WorkoutFormat, config: WodConfig | null) => void;
  disabled?: boolean;
}

/**
 * Inline format pill for the section header row.
 * Shows the current format as a coloured pill with a dropdown to switch formats.
 */
export function SectionFormatPill({
  format,
  onFormatChange,
  disabled,
}: SectionFormatPillProps) {
  const { t } = useTranslation();

  const handleFormatChange = (newFormat: WorkoutFormat) => {
    if (newFormat === format) return;
    onFormatChange(newFormat, newFormat === 'Standard' ? null : defaultConfig(newFormat));
  };

  return (
    <div className="relative inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
      <select
        value={format}
        disabled={disabled}
        onChange={(e) => handleFormatChange(e.target.value as WorkoutFormat)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          border: '1px solid var(--border)',
          borderRadius: 99,
          background: format !== 'Standard' ? 'var(--accent-bg)' : 'var(--bg)',
          color: format !== 'Standard' ? 'var(--accent)' : 'var(--text2)',
          fontSize: 11,
          fontFamily: 'inherit',
          fontWeight: 600,
          padding: '2px 20px 2px 9px',
          cursor: disabled ? 'default' : 'pointer',
          outline: 'none',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
        }}
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {t(`training.format.${f.charAt(0).toLowerCase() + f.slice(1)}`)}
          </option>
        ))}
      </select>
      <span
        style={{
          position: 'absolute',
          right: 6,
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
