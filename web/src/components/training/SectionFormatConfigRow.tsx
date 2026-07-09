import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';
import { estimatedSectionDurationSeconds, formatDurationCompact } from '@/lib/training-plan-format';
import { parseNumericInput } from '@/lib/parseNumericInput';

interface SectionFormatConfigRowProps {
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  onChange: (patch: Partial<WodConfig>) => void;
}

/** Right-aligned duration caption — `≈ 12 min` / `≈ 4 min 30 s` / `≈ 40 s`. */
function DurationCaption({
  format,
  formatConfig,
}: {
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
}) {
  const seconds = estimatedSectionDurationSeconds(format, formatConfig);
  if (seconds == null || seconds <= 0) return null;
  return (
    <span
      className="ml-auto text-[11px] text-text3"
      style={{ fontWeight: 500, whiteSpace: 'nowrap' }}
    >
      ≈ {formatDurationCompact(seconds)}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: 60,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  fontWeight: 600,
  padding: '3px 7px',
  outline: 'none',
  textAlign: 'right' as const,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text3)',
  fontWeight: 500,
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
};

/**
 * Format-specific config inputs rendered as a separate row below the section description.
 * Only rendered for non-Standard formats.
 *
 * Time-cap inputs for AMRAP and ForTime are in MINUTES (stored as seconds).
 * Read: divide by 60. Write: multiply by 60.
 * EMOM/Tabata intervals and rest times remain in seconds — they match the prototype labels.
 */
export function SectionFormatConfigRow({
  format,
  formatConfig,
  onChange,
}: SectionFormatConfigRowProps) {
  const { t } = useTranslation();
  const uid = useId();

  if (format === 'Standard') return null;

  switch (format) {
    case 'AMRAP':
      return (
        <div
          className="flex items-center gap-4 px-3 py-2 border-b border-border"
          style={{ background: 'var(--bg2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Time cap — stored as seconds, displayed as minutes */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-amrap-time-cap`} style={labelStyle}>{t('training.section.amrapTimeCap')}</label>
            <input
              id={`${uid}-amrap-time-cap`}
              type="number"
              placeholder="--"
              min={1}
              value={
                formatConfig?.timeCapSeconds != null
                  ? Math.round(formatConfig.timeCapSeconds / 60)
                  : ''
              }
              style={inputStyle}
              onChange={(e) => {
                const minutes = parseNumericInput(e.target.value, 1);
                if (minutes !== undefined) {
                  onChange({ timeCapSeconds: minutes === null ? null : Math.round(minutes * 60) });
                }
              }}
            />
          </div>
          {/* Total rounds (0 = unlimited) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-amrap-total-rounds`} style={labelStyle}>{t('training.section.amrapTotalRounds')}</label>
            <input
              id={`${uid}-amrap-total-rounds`}
              type="number"
              placeholder="0"
              min={0}
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 0);
                if (parsed !== undefined) onChange({ totalRounds: parsed });
              }}
            />
          </div>
          <DurationCaption format={format} formatConfig={formatConfig} />
        </div>
      );

    case 'ForTime':
      return (
        <div
          className="flex items-center gap-4 px-3 py-2 border-b border-border"
          style={{ background: 'var(--bg2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Time cap — stored as seconds, displayed as minutes */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-fortime-time-cap`} style={labelStyle}>{t('training.section.fortimeTimeCap')}</label>
            <input
              id={`${uid}-fortime-time-cap`}
              type="number"
              placeholder="--"
              min={1}
              value={
                formatConfig?.timeCapSeconds != null
                  ? Math.round(formatConfig.timeCapSeconds / 60)
                  : ''
              }
              style={inputStyle}
              onChange={(e) => {
                const minutes = parseNumericInput(e.target.value, 1);
                if (minutes !== undefined) {
                  onChange({ timeCapSeconds: minutes === null ? null : Math.round(minutes * 60) });
                }
              }}
            />
          </div>
          <DurationCaption format={format} formatConfig={formatConfig} />
        </div>
      );

    case 'EMOM':
      return (
        <div
          className="flex items-center gap-4 px-3 py-2 border-b border-border"
          style={{ background: 'var(--bg2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Interval in seconds */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-emom-interval`} style={labelStyle}>{t('training.section.emomInterval')}</label>
            <input
              id={`${uid}-emom-interval`}
              type="number"
              placeholder="60"
              min={1}
              value={formatConfig?.intervalSeconds ?? ''}
              style={inputStyle}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) onChange({ intervalSeconds: parsed });
              }}
            />
          </div>
          {/* Total rounds */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-emom-total-rounds`} style={labelStyle}>{t('training.section.emomRounds')}</label>
            <input
              id={`${uid}-emom-total-rounds`}
              type="number"
              placeholder="--"
              min={1}
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) onChange({ totalRounds: parsed });
              }}
            />
          </div>
          <DurationCaption format={format} formatConfig={formatConfig} />
        </div>
      );

    case 'Tabata':
      return (
        <div
          className="flex items-center gap-4 px-3 py-2 border-b border-border"
          style={{ background: 'var(--bg2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Work interval in seconds */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-tabata-work`} style={labelStyle}>{t('training.section.tabataWork')}</label>
            <input
              id={`${uid}-tabata-work`}
              type="number"
              placeholder="20"
              min={1}
              value={formatConfig?.workSeconds ?? ''}
              style={inputStyle}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) onChange({ workSeconds: parsed });
              }}
            />
          </div>
          {/* Rest interval in seconds */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-tabata-rest`} style={labelStyle}>{t('training.section.tabataRest')}</label>
            <input
              id={`${uid}-tabata-rest`}
              type="number"
              placeholder="10"
              min={1}
              value={formatConfig?.restSeconds ?? ''}
              style={inputStyle}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) onChange({ restSeconds: parsed });
              }}
            />
          </div>
          {/* Total rounds */}
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-tabata-rounds`} style={labelStyle}>{t('training.section.tabataRounds')}</label>
            <input
              id={`${uid}-tabata-rounds`}
              type="number"
              placeholder="8"
              min={1}
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) onChange({ totalRounds: parsed });
              }}
            />
          </div>
          <DurationCaption format={format} formatConfig={formatConfig} />
        </div>
      );

    default:
      return null;
  }
}
