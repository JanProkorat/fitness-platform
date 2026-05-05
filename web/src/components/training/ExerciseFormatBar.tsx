import { useTranslation } from 'react-i18next';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';

const FORMATS: WorkoutFormat[] = ['Standard', 'EMOM', 'AMRAP', 'ForTime', 'Tabata'];

interface ExerciseFormatBarProps {
  /** Current per-exercise format override. Null = inherit session format. */
  format: WorkoutFormat | null | undefined;
  formatConfig?: WodConfig | null;
  /** Format inherited from the parent session, shown as placeholder text. */
  sessionFormat: WorkoutFormat;
  onFormatChange: (format: WorkoutFormat | null, config: WodConfig | null) => void;
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
 * Per-exercise format override bar.
 * When `format` is null the exercise inherits the session's format — an
 * "Inherit" pill is shown instead of config knobs.
 */
export function ExerciseFormatBar({
  format,
  formatConfig,
  sessionFormat,
  onFormatChange,
  disabled,
}: ExerciseFormatBarProps) {
  const { t } = useTranslation();

  const effectiveFormat = format ?? null;

  const handleFormatChange = (newFormat: WorkoutFormat | 'inherit') => {
    if (newFormat === 'inherit') {
      onFormatChange(null, null);
    } else {
      onFormatChange(
        newFormat,
        newFormat === 'Standard' ? null : defaultConfig(newFormat),
      );
    }
  };

  const updateConfig = (patch: Partial<WodConfig>) => {
    if (!effectiveFormat) return;
    onFormatChange(effectiveFormat, { ...(formatConfig ?? {}), ...patch });
  };

  const inputStyle: React.CSSProperties = {
    width: 52,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 10,
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
    if (!effectiveFormat || effectiveFormat === 'Standard') return null;

    switch (effectiveFormat) {
      case 'ForTime':
      case 'AMRAP':
        return (
          <span className="flex items-center gap-1.5">
            <span style={labelStyle}>{t('training.wod.timeCap')}</span>
            <input
              type="number"
              placeholder="--"
              value={formatConfig?.timeCapSeconds ?? ''}
              style={inputStyle}
              onChange={(e) =>
                updateConfig({ timeCapSeconds: e.target.value !== '' ? Number(e.target.value) : null })
              }
            />
            <span style={labelStyle}>s</span>
          </span>
        );

      case 'EMOM':
        return (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span style={labelStyle}>{t('training.wod.interval')}</span>
              <input
                type="number"
                placeholder="60"
                value={formatConfig?.intervalSeconds ?? ''}
                style={inputStyle}
                onChange={(e) =>
                  updateConfig({ intervalSeconds: e.target.value !== '' ? Number(e.target.value) : null })
                }
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1">
              <span style={labelStyle}>{t('training.wod.rounds')}</span>
              <input
                type="number"
                placeholder="--"
                value={formatConfig?.totalRounds ?? ''}
                style={{ ...inputStyle, width: 40 }}
                onChange={(e) =>
                  updateConfig({ totalRounds: e.target.value !== '' ? Number(e.target.value) : null })
                }
              />
            </span>
          </span>
        );

      case 'Tabata':
        return (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span style={labelStyle}>{t('training.wod.workSeconds')}</span>
              <input
                type="number"
                placeholder="20"
                value={formatConfig?.workSeconds ?? ''}
                style={inputStyle}
                onChange={(e) =>
                  updateConfig({ workSeconds: e.target.value !== '' ? Number(e.target.value) : null })
                }
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1">
              <span style={labelStyle}>{t('training.wod.restSeconds')}</span>
              <input
                type="number"
                placeholder="10"
                value={formatConfig?.restSeconds ?? ''}
                style={inputStyle}
                onChange={(e) =>
                  updateConfig({ restSeconds: e.target.value !== '' ? Number(e.target.value) : null })
                }
              />
              <span style={labelStyle}>s</span>
            </span>
            <span className="flex items-center gap-1">
              <span style={labelStyle}>{t('training.wod.rounds')}</span>
              <input
                type="number"
                placeholder="8"
                value={formatConfig?.totalRounds ?? ''}
                style={{ ...inputStyle, width: 40 }}
                onChange={(e) =>
                  updateConfig({ totalRounds: e.target.value !== '' ? Number(e.target.value) : null })
                }
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
      className="flex items-center gap-2 px-3 py-1 border-b border-border"
      style={{ background: 'var(--bg)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Format selector — includes "Inherit" as the null option */}
      <div className="relative inline-flex shrink-0">
        <select
          value={effectiveFormat ?? 'inherit'}
          disabled={disabled}
          onChange={(e) => handleFormatChange(e.target.value as WorkoutFormat | 'inherit')}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: effectiveFormat ? 'var(--accent-bg)' : 'var(--bg2)',
            color: effectiveFormat ? 'var(--accent)' : 'var(--text4)',
            fontSize: 10,
            fontFamily: 'inherit',
            fontWeight: 500,
            padding: '1px 16px 1px 6px',
            cursor: disabled ? 'default' : 'pointer',
            outline: 'none',
            lineHeight: '16px',
          }}
        >
          <option value="inherit">
            {t('training.format.inherit', { parent: t(`training.format.${sessionFormat.charAt(0).toLowerCase() + sessionFormat.slice(1)}`) })}
          </option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`training.format.${f.charAt(0).toLowerCase() + f.slice(1)}`)}
            </option>
          ))}
        </select>
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

      {renderConfig()}
    </div>
  );
}
