import { useTranslation } from 'react-i18next';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';

interface SectionFormatConfigRowProps {
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  onChange: (patch: Partial<WodConfig>) => void;
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
            <label style={labelStyle}>{t('training.section.amrapTimeCap')}</label>
            <input
              type="number"
              placeholder="--"
              value={
                formatConfig?.timeCapSeconds != null
                  ? Math.round(formatConfig.timeCapSeconds / 60)
                  : ''
              }
              style={inputStyle}
              onChange={(e) =>
                onChange({
                  timeCapSeconds:
                    e.target.value !== ''
                      ? Math.round(Number(e.target.value) * 60)
                      : null,
                })
              }
            />
          </div>
          {/* Total rounds (0 = unlimited) */}
          <div className="flex items-center gap-1.5">
            <label style={labelStyle}>{t('training.section.amrapTotalRounds')}</label>
            <input
              type="number"
              placeholder="0"
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) =>
                onChange({
                  totalRounds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
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
            <label style={labelStyle}>{t('training.section.fortimeTimeCap')}</label>
            <input
              type="number"
              placeholder="--"
              value={
                formatConfig?.timeCapSeconds != null
                  ? Math.round(formatConfig.timeCapSeconds / 60)
                  : ''
              }
              style={inputStyle}
              onChange={(e) =>
                onChange({
                  timeCapSeconds:
                    e.target.value !== ''
                      ? Math.round(Number(e.target.value) * 60)
                      : null,
                })
              }
            />
          </div>
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
            <label style={labelStyle}>{t('training.section.emomInterval')}</label>
            <input
              type="number"
              placeholder="60"
              value={formatConfig?.intervalSeconds ?? ''}
              style={inputStyle}
              onChange={(e) =>
                onChange({
                  intervalSeconds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          {/* Total rounds */}
          <div className="flex items-center gap-1.5">
            <label style={labelStyle}>{t('training.section.emomRounds')}</label>
            <input
              type="number"
              placeholder="--"
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) =>
                onChange({
                  totalRounds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
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
            <label style={labelStyle}>{t('training.section.tabataWork')}</label>
            <input
              type="number"
              placeholder="20"
              value={formatConfig?.workSeconds ?? ''}
              style={inputStyle}
              onChange={(e) =>
                onChange({
                  workSeconds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          {/* Rest interval in seconds */}
          <div className="flex items-center gap-1.5">
            <label style={labelStyle}>{t('training.section.tabataRest')}</label>
            <input
              type="number"
              placeholder="10"
              value={formatConfig?.restSeconds ?? ''}
              style={inputStyle}
              onChange={(e) =>
                onChange({
                  restSeconds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          {/* Total rounds */}
          <div className="flex items-center gap-1.5">
            <label style={labelStyle}>{t('training.section.tabataRounds')}</label>
            <input
              type="number"
              placeholder="8"
              value={formatConfig?.totalRounds ?? ''}
              style={{ ...inputStyle, width: 52 }}
              onChange={(e) =>
                onChange({
                  totalRounds:
                    e.target.value !== '' ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
