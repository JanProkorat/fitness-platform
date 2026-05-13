import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';
import { FORMAT_LABEL_KEYS, FORMAT_BG_COLORS, FORMAT_COLORS } from '@/constants/training';

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
 * Shows the current format as a coloured pill with a native select to switch formats.
 * Colors come from FORMAT_PILL_CLASSES — no hex literals, no CSS vars.
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
        style={{ background: FORMAT_BG_COLORS[format], color: FORMAT_COLORS[format] }}
        className={cn(
          // Base pill shape — borderless to match the static chip style on
          // the workouts table and exercise muscle-group chips.
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
          'cursor-pointer outline-none appearance-none leading-[18px] whitespace-nowrap',
          // Right padding to leave room for the chevron indicator
          'pr-[22px]',
          // Transition
          'transition-colors duration-100',
          // Disabled state
          disabled && 'cursor-default opacity-60',
        )}
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {t(`training.format.${FORMAT_LABEL_KEYS[f]}`)}
          </option>
        ))}
      </select>
      {/* Chevron indicator — pointer-events:none so it doesn't block the select */}
      <span
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] leading-none"
        aria-hidden="true"
      >
        ▾
      </span>
    </div>
  );
}
