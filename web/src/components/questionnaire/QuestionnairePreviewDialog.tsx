import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui';
import type { QuestionnaireDto } from '@/api/questionnaires';

interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  questionnaire: QuestionnaireDto;
}

const TYPE_ICONS: Record<string, string> = {
  short_text: 'Aa',
  single_choice: '◉',
  multi_select: '☑',
  number: '#',
  scale: '⟷',
  file_upload: '📎',
};

export function QuestionnairePreviewDialog({ open, onClose, questionnaire }: PreviewDialogProps) {
  const { t } = useTranslation();

  const visibleQuestions = questionnaire.questions.filter((q) => !q.isHidden);

  return (
    <Dialog open={open} onClose={onClose} title={t('questionnaire.previewTitle')} maxWidth={560}>
      <div>
        {/* Title */}
        <h3
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}
        >
          {questionnaire.title}
        </h3>

        {/* Description */}
        {questionnaire.description && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text2)',
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            {questionnaire.description}
          </p>
        )}

        {/* Questions */}
        {visibleQuestions.length === 0 ? (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--text3)',
              fontSize: 13,
            }}
          >
            {t('questionnaire.previewEmpty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {visibleQuestions.map((q, i) => (
              <div
                key={q.publicId || i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text3)',
                      flexShrink: 0,
                      width: 20,
                      textAlign: 'center',
                      marginTop: 1,
                    }}
                  >
                    {TYPE_ICONS[q.type] ?? '?'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                      {q.label}
                      {q.isRequired && (
                        <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
                      )}
                    </div>
                    {q.helperText && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {q.helperText}
                      </div>
                    )}

                    {/* Preview of options */}
                    {(q.type === 'single_choice' || q.type === 'multi_select') && q.config && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(() => {
                          try {
                            const cfg = JSON.parse(q.config) as { options?: string[] };
                            return (cfg.options ?? []).map((opt, j) => (
                              <div
                                key={j}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  color: 'var(--text2)',
                                }}
                              >
                                <span
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: q.type === 'single_choice' ? '50%' : 3,
                                    border: '1px solid var(--border-md)',
                                    flexShrink: 0,
                                  }}
                                />
                                {opt || '...'}
                              </div>
                            ));
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    )}

                    {/* Scale preview */}
                    {q.type === 'scale' && q.config && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                        {(() => {
                          try {
                            const cfg = JSON.parse(q.config) as {
                              min?: number;
                              max?: number;
                              labelMin?: string;
                              labelMax?: string;
                            };
                            return `${cfg.labelMin || cfg.min} ... ${cfg.labelMax || cfg.max}`;
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    )}

                    {/* Number preview */}
                    {q.type === 'number' && q.config && (
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            width: '100%',
                            height: 30,
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                    )}

                    {/* Short text preview */}
                    {q.type === 'short_text' && (
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            width: '100%',
                            height: 30,
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            background: 'var(--bg)',
                          }}
                        />
                      </div>
                    )}

                    {/* File upload preview */}
                    {q.type === 'file_upload' && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: '10px 12px',
                          border: '1px dashed var(--border-md)',
                          borderRadius: 'var(--radius)',
                          textAlign: 'center',
                          fontSize: 12,
                          color: 'var(--text3)',
                        }}
                      >
                        📎
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
