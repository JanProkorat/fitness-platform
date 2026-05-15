/**
 * SectionFormatBar — compatibility shim.
 *
 * The format selector was split into two focused pieces:
 *  - SectionFormatPill     — the pill/dropdown for the header row
 *  - SectionFormatConfigRow — the config-knob row below the description
 *
 * This file re-exports both under the old combined API so any external consumers
 * (outside of SectionCard) keep working without changes.
 *
 * New code should import SectionFormatPill and SectionFormatConfigRow directly.
 */

import { SectionFormatPill } from './SectionFormatPill';
import { SectionFormatConfigRow } from './SectionFormatConfigRow';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';

export interface SectionFormatBarProps {
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  onFormatChange: (format: WorkoutFormat, config: WodConfig | null) => void;
  disabled?: boolean;
}

/**
 * @deprecated Use SectionFormatPill + SectionFormatConfigRow separately.
 */
export function SectionFormatBar({
  format,
  formatConfig,
  onFormatChange,
  disabled,
}: SectionFormatBarProps) {
  const updateConfig = (patch: Partial<WodConfig>) => {
    onFormatChange(format, { ...(formatConfig ?? {}), ...patch });
  };

  return (
    <>
      <SectionFormatPill
        format={format}
        onFormatChange={onFormatChange}
        disabled={disabled}
      />
      <SectionFormatConfigRow
        format={format}
        formatConfig={formatConfig}
        onChange={updateConfig}
      />
    </>
  );
}
