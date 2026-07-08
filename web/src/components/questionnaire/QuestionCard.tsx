import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuestionDto } from '@/api/questionnaires';

interface QuestionCardProps {
  question: QuestionDto;
  onChange: (updated: QuestionDto) => void;
  onRemove: () => void;
  defaultExpanded?: boolean;
}

const QUESTION_TYPES = [
  'section',
  'short_text',
  'single_choice',
  'multi_select',
  'number',
  'scale',
  'file_upload',
] as const;

const MAPPED_FIELDS = [
  'none',
  'height',
  'weight',
  'birthDate',
  'sex',
  'targetWeight',
  'bodyType',
  'goal',
  'timeHorizon',
  'jobType',
  'sleepHours',
  'stressLevel',
  'activityLevel',
  'currentTrainingFrequency',
  'desiredTrainingFrequency',
  'fitnessRating',
  'gymAccess',
  'preferredActivities',
  'injuries',
  'mealsPerDay',
  'dietaryStyle',
  'allergies',
  'dietRating',
  'planExperience',
  'pastBlockers',
  'primaryMotivation',
] as const;

const TYPE_ICONS: Record<string, string> = {
  section: '§',
  short_text: 'Aa',
  single_choice: '◉',
  multi_select: '☑',
  number: '#',
  scale: '⟷',
  file_upload: '📎',
};

const parseConfig = (config: string | null | undefined): Record<string, unknown> => {
  if (!config) return {};
  try {
    return JSON.parse(config) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const serializeConfig = (obj: Record<string, unknown>): string => JSON.stringify(obj);

export function QuestionCard({ question, onChange, onRemove, defaultExpanded = false }: QuestionCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const config = parseConfig(question.config);

  const updateField = <K extends keyof QuestionDto>(key: K, value: QuestionDto[K]) => {
    onChange({ ...question, [key]: value });
  };

  const updateConfig = (patch: Record<string, unknown>) => {
    const newConfig = { ...config, ...patch };
    onChange({ ...question, config: serializeConfig(newConfig) });
  };

  const handleTypeChange = (newType: string) => {
    // Reset config when type changes
    let defaultConfig = '{}';
    if (newType === 'single_choice' || newType === 'multi_select') {
      defaultConfig = JSON.stringify({ options: [''] });
    } else if (newType === 'number') {
      defaultConfig = JSON.stringify({ min: 0, max: 100, unit: '', step: 1 });
    } else if (newType === 'scale') {
      defaultConfig = JSON.stringify({ min: 1, max: 10, labelMin: '', labelMax: '' });
    }
    onChange({ ...question, type: newType, config: defaultConfig });
  };

  // Options editor for single_choice / multi_select
  const options = (config.options as string[] | undefined) ?? [];

  const setOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    updateConfig({ options: next });
  };

  const removeOption = (index: number) => {
    updateConfig({ options: options.filter((_, i) => i !== index) });
  };

  const addOption = () => {
    updateConfig({ options: [...options, ''] });
  };

  const typeLabel = t(`questionnaire.type${question.type.charAt(0).toUpperCase() + question.type.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` as string);

  const isSection = question.type === 'section';

  return (
    <div
      style={{
        background: isSection ? 'var(--bg)' : 'var(--bg2)',
        border: '1px solid var(--border)',
        borderLeft: isSection ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 8,
        marginTop: isSection ? 16 : 0,
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            cursor: 'grab',
            color: 'var(--text4)',
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--text3)',
            flexShrink: 0,
            width: 24,
            textAlign: 'center',
          }}
        >
          {TYPE_ICONS[question.type] ?? '?'}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: isSection ? 14 : 13,
            fontWeight: isSection ? 600 : 400,
            color: question.label ? 'var(--text)' : 'var(--text3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {question.label || (isSection ? t('questionnaire.sectionPlaceholder') : t('questionnaire.questionLabelPlaceholder'))}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text4)', flexShrink: 0 }}>
          {typeLabel}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text4)',
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Type (hidden for sections) */}
          {!isSection && (
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontSize: 11 }}>
              {t('questionnaire.typeFieldLabel')}
            </label>
            <select
              className="form-select"
              value={question.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              style={{ fontSize: 13 }}
            >
              {QUESTION_TYPES.filter((t) => t !== 'section').map((type) => {
                const key = `questionnaire.type${type.charAt(0).toUpperCase() + type.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`;
                return (
                  <option key={type} value={type}>
                    {t(key as string)}
                  </option>
                );
              })}
            </select>
          </div>
          )}

          {/* Label / Section title */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontSize: 11 }}>
              {question.type === 'section' ? t('questionnaire.sectionTitle') : t('questionnaire.questionLabel')}
            </label>
            <input
              className="form-input"
              value={question.label}
              onChange={(e) => updateField('label', e.target.value)}
              placeholder={t('questionnaire.questionLabelPlaceholder')}
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Helper text */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontSize: 11 }}>
              {t('questionnaire.helperTextLabel')}
            </label>
            <input
              className="form-input"
              value={question.helperText ?? ''}
              onChange={(e) => updateField('helperText', e.target.value || null)}
              placeholder={t('questionnaire.helperTextPlaceholder')}
              style={{ fontSize: 13 }}
            />
          </div>

          {question.type !== 'section' && (
          <>
          {/* Required toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {t('questionnaire.required')}
            </span>
            <button
              type="button"
              className={`toggle${question.isRequired ? ' on' : ''}`}
              onClick={() => updateField('isRequired', !question.isRequired)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {/* Type-specific config */}
          {(question.type === 'single_choice' || question.type === 'multi_select') && (
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: 11 }}>
                {t('questionnaire.optionsLabel')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="form-input"
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={t('questionnaire.optionPlaceholder')}
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      style={{
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'var(--text4)',
                        fontSize: 12,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    border: '1px dashed var(--border-md)',
                    borderRadius: 'var(--radius)',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    alignSelf: 'flex-start',
                  }}
                >
                  + {t('questionnaire.addOption')}
                </button>
              </div>
            </div>
          )}

          {/* Allow custom answer toggle (multi_select only) */}
          {question.type === 'multi_select' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {t('questionnaire.allowCustom')}
              </span>
              <button
                type="button"
                className={`toggle${config.allowCustom ? ' on' : ''}`}
                onClick={() => updateConfig({ allowCustom: !config.allowCustom })}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          )}

          {question.type === 'number' && (
            <div className="form-row" style={{ marginBottom: 10, gap: 8 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>
                  {t('questionnaire.configMin')}
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={(config.min as number) ?? 0}
                  onChange={(e) => updateConfig({ min: Number(e.target.value) })}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>
                  {t('questionnaire.configMax')}
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={(config.max as number) ?? 100}
                  onChange={(e) => updateConfig({ max: Number(e.target.value) })}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>
                  {t('questionnaire.configUnit')}
                </label>
                <input
                  className="form-input"
                  value={(config.unit as string) ?? ''}
                  onChange={(e) => updateConfig({ unit: e.target.value })}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>
                  {t('questionnaire.configStep')}
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={(config.step as number) ?? 1}
                  onChange={(e) => updateConfig({ step: Number(e.target.value) })}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {question.type === 'scale' && (
            <div style={{ marginBottom: 10 }}>
              <div className="form-row" style={{ gap: 8, marginBottom: 8 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>
                    {t('questionnaire.configMin')}
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    value={(config.min as number) ?? 1}
                    onChange={(e) => updateConfig({ min: Number(e.target.value) })}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>
                    {t('questionnaire.configMax')}
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    value={(config.max as number) ?? 10}
                    onChange={(e) => updateConfig({ max: Number(e.target.value) })}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
              <div className="form-row" style={{ gap: 8 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>
                    {t('questionnaire.configLabelMin')}
                  </label>
                  <input
                    className="form-input"
                    value={(config.labelMin as string) ?? ''}
                    onChange={(e) => updateConfig({ labelMin: e.target.value })}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>
                    {t('questionnaire.configLabelMax')}
                  </label>
                  <input
                    className="form-input"
                    value={(config.labelMax as string) ?? ''}
                    onChange={(e) => updateConfig({ labelMax: e.target.value })}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mapped field */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontSize: 11 }}>
              {t('questionnaire.mappedField')}
            </label>
            <select
              className="form-select"
              value={question.mappedField ?? 'none'}
              onChange={(e) =>
                updateField('mappedField', e.target.value === 'none' ? null : e.target.value)
              }
              style={{ fontSize: 13 }}
            >
              {(() => {
                const getLabel = (field: string) =>
                  t(`questionnaire.mapped${field.charAt(0).toUpperCase() + field.slice(1)}` as string);
                const sorted = MAPPED_FIELDS
                  .filter((f) => f !== 'none')
                  .slice()
                  .sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
                return (
                  <>
                    <option value="none">{getLabel('none')}</option>
                    {sorted.map((field) => (
                      <option key={field} value={field}>
                        {getLabel(field)}
                      </option>
                    ))}
                  </>
                );
              })()}
            </select>
          </div>
          </>
          )}

          {/* Delete button */}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onRemove}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                border: 'none',
                borderRadius: 'var(--radius)',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--red)',
                fontSize: 12,
                fontFamily: 'inherit',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--red-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              {t('questionnaire.deleteQuestion')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
