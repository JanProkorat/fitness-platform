import { useTranslation } from 'react-i18next';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';
import { FORMAT_LABEL_KEYS } from '@/constants/training';
import { parseNumericInput } from '@/lib/parseNumericInput';

const FORMATS: WorkoutFormat[] = ['Standard', 'EMOM', 'AMRAP', 'ForTime', 'Tabata'];

interface SessionFormatBarProps {
  format: WorkoutFormat;
  formatConfig?: WodConfig | null;
  onFormatChange: (format: WorkoutFormat, config: WodConfig | null) => void;
  disabled?: boolean;
}

function defaultConfig(format: WorkoutFormat): WodConfig | null {
  switch (format) {
    case 'ForTime':
      return { timeCapSeconds: null };
    case 'AMRAP':
      return { timeCapSeconds: null };
    case 'EMOM':
      return { intervalSeconds: 60, totalRounds: null };
    case 'Tabata':
      return { workSeconds: 20, restSeconds: 10, totalRounds: 8 };
    default:
      return null;
  }
}

/**
 * Session header strip showing the format dropdown and inline config knobs
 * for non-Standard formats. Shown at the top of each session card.
 */
export function SessionFormatBar({
  format,
  formatConfig,
  onFormatChange,
  disabled,
}: SessionFormatBarProps) {
  const { t } = useTranslation();

  const handleFormatChange = (newFormat: WorkoutFormat) => {
    if (newFormat === format) return;
    onFormatChange(newFormat, newFormat === 'Standard' ? null : defaultConfig(newFormat));
  };

  const updateConfig = (patch: Partial<WodConfig>) => {
    onFormatChange(format, { ...(formatConfig ?? {}), ...patch });
  };

  const inputStyle: React.CSSProperties = {
    width: 60,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 11,
    fontFamily: 'inherit',
    padding: '1px 4px',
    outline: 'none',
    textAlign: 'right' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text3)',
    fontWeight: 500,
    userSelect: 'none' as const,
  };

  const renderConfig = () => {
    if (format === 'Standard') return null;

    switch (format) {
      case 'ForTime':
        return (
          <span className="flex items-center gap-2">
            <span style={labelStyle}>{t('training.wod.timeCap')}</span>
            <input
              type="number"
              placeholder="--"
              min={1}
              value={formatConfig?.timeCapSeconds ?? ''}
              aria-label={t('training.wod.timeCapAriaLabel')}
              style={inputStyle}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) updateConfig({ timeCapSeconds: parsed });
              }}
            />
            <span style={labelStyle}>s</span>
          </span>
        );

      case 'AMRAP':
        return (
          <span className="flex items-center gap-2">
            <span style={labelStyle}>{t('training.wod.timeCap')}</span>
            <input
              type="number"
              placeholder="--"
              min={1}
              value={formatConfig?.timeCapSeconds ?? ''}
              aria-label={t('training.wod.timeCapAriaLabel')}
              style={inputStyle}
              onChange={(e) => {
                const parsed = parseNumericInput(e.target.value, 1);
                if (parsed !== undefined) updateConfig({ timeCapSeconds: parsed });
              }}
            />
            <span style={labelStyle}>s</span>
          </span>
        );

      case 'EMOM':
        return (
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span style={labelStyle}>{t('training.wod.interval')}</span>
              <input
                type="number"
                placeholder="60"
                min={1}
                value={formatConfig?.intervalSeconds ?? ''}
                aria-label={t('training.wod.intervalAriaLabel')}
                style={inputStyle}
                onChange={(e) => {
                  const parsed = parseNumericInput(e.target.value, 1);
                  if (parsed !== undefined) updateConfig({ intervalSeconds: parsed });
                }}
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span style={labelStyle}>{t('training.wod.rounds')}</span>
              <input
                type="number"
                placeholder="--"
                min={1}
                value={formatConfig?.totalRounds ?? ''}
                aria-label={t('training.wod.roundsAriaLabel')}
                style={{ ...inputStyle, width: 46 }}
                onChange={(e) => {
                  const parsed = parseNumericInput(e.target.value, 1);
                  if (parsed !== undefined) updateConfig({ totalRounds: parsed });
                }}
              />
            </span>
          </span>
        );

      case 'Tabata':
        return (
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span style={labelStyle}>{t('training.wod.workSeconds')}</span>
              <input
                type="number"
                placeholder="20"
                min={1}
                value={formatConfig?.workSeconds ?? ''}
                aria-label={t('training.wod.workSecondsAriaLabel')}
                style={inputStyle}
                onChange={(e) => {
                  const parsed = parseNumericInput(e.target.value, 1);
                  if (parsed !== undefined) updateConfig({ workSeconds: parsed });
                }}
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span style={labelStyle}>{t('training.wod.restSeconds')}</span>
              <input
                type="number"
                placeholder="10"
                min={1}
                value={formatConfig?.restSeconds ?? ''}
                aria-label={t('training.wod.restSecondsAriaLabel')}
                style={inputStyle}
                onChange={(e) => {
                  const parsed = parseNumericInput(e.target.value, 1);
                  if (parsed !== undefined) updateConfig({ restSeconds: parsed });
                }}
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span style={labelStyle}>{t('training.wod.rounds')}</span>
              <input
                type="number"
                placeholder="8"
                min={1}
                value={formatConfig?.totalRounds ?? ''}
                aria-label={t('training.wod.roundsAriaLabel')}
                style={{ ...inputStyle, width: 46 }}
                onChange={(e) => {
                  const parsed = parseNumericInput(e.target.value, 1);
                  if (parsed !== undefined) updateConfig({ totalRounds: parsed });
                }}
              />
            </span>
          </span>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 border-b border-border"
      style={{ background: 'var(--bg2)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Format dropdown */}
      <div className="relative inline-flex shrink-0">
        <select
          value={format}
          disabled={disabled}
          aria-label={t('training.sessionFormatAriaLabel')}
          onChange={(e) => handleFormatChange(e.target.value as WorkoutFormat)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: format !== 'Standard' ? 'var(--accent-bg)' : 'var(--bg)',
            color: format !== 'Standard' ? 'var(--accent)' : 'var(--text2)',
            fontSize: 11,
            fontFamily: 'inherit',
            fontWeight: 600,
            padding: '2px 20px 2px 8px',
            cursor: disabled ? 'default' : 'pointer',
            outline: 'none',
            lineHeight: '18px',
          }}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`training.format.${FORMAT_LABEL_KEYS[f]}`)}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 5,
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

      {/* Inline config knobs */}
      {renderConfig()}
    </div>
  );
}
