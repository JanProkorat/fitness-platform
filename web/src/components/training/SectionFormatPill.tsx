import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
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

/**
 * Format-specific pill color classes (Tailwind palette — no hex literals).
 * Applied to the pill wrapper element which renders as a styled <select>.
 */
const FORMAT_PILL_CLASSES: Record<WorkoutFormat, string> = {
  Standard: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
  AMRAP:    'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100',
  EMOM:     'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100',
  Tabata:   'bg-pink-50 text-pink-700 border-pink-300 hover:bg-pink-100',
  ForTime:  'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100',
};

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
        className={cn(
          // Base pill shape
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
          'cursor-pointer outline-none appearance-none leading-[18px] whitespace-nowrap',
          // Right padding to leave room for the chevron indicator
          'pr-[22px]',
          // Transition
          'transition-colors duration-100',
          // Disabled state
          disabled && 'cursor-default opacity-60',
          // Format-specific colors
          FORMAT_PILL_CLASSES[format],
        )}
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {t(`training.format.${f.charAt(0).toLowerCase() + f.slice(1)}`)}
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
