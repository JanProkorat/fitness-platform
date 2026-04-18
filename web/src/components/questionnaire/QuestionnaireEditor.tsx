import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useToastStore } from '@/stores/toast';
import {
  getTrainerQuestionnaire,
  updateQuestionnaire,
  type QuestionnaireDto,
  type QuestionDto,
} from '@/api/questionnaires';
import { QuestionCard } from './QuestionCard';
import { QuestionnairePreview } from './QuestionnairePreview';

function SortableQuestionCard({
  id,
  index,
  question,
  onChange,
  onRemove,
  defaultExpanded,
}: {
  id: string;
  index: number;
  question: QuestionDto;
  onChange: (updated: QuestionDto) => void;
  onRemove: () => void;
  defaultExpanded?: boolean;
}) {
  const { ref } = useSortable({ id, index });
  return (
    <div ref={ref}>
      <QuestionCard question={question} onChange={onChange} onRemove={onRemove} defaultExpanded={defaultExpanded} />
    </div>
  );
}

export interface QuestionnaireEditorHandle {
  save: () => Promise<void>;
}

interface QuestionnaireEditorProps {
  publicId: string;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
}

export const QuestionnaireEditor = forwardRef<QuestionnaireEditorHandle, QuestionnaireEditorProps>(function QuestionnaireEditor({ publicId, onBack, onDirtyChange, onSavingChange }, ref) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dirty tracking
  const savedSnapshot = useRef<string>('');
  const [loaded, setLoaded] = useState(false);

  const getSnapshot = (q: QuestionnaireDto) =>
    JSON.stringify({ title: q.title, description: q.description, isActive: q.isActive, isDefault: q.isDefault, questions: q.questions });

  const isDirty = loaded && questionnaire !== null && getSnapshot(questionnaire) !== savedSnapshot.current;

  // Notify parent of state changes
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  // Load questionnaire by publicId
  useEffect(() => {
    setLoading(true);
    setLoaded(false);
    (async () => {
      try {
        const data = await getTrainerQuestionnaire(publicId);
        setQuestionnaire(data);
        savedSnapshot.current = getSnapshot(data);
      } catch {
        // failed to load
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    })();
  }, [publicId]);

  const handleSave = useCallback(async () => {
    if (!questionnaire) return;
    setSaving(true);
    try {
      const updated = await updateQuestionnaire(publicId, {
        title: questionnaire.title,
        description: questionnaire.description,
        isActive: questionnaire.isActive,
        isDefault: questionnaire.isDefault,
        questions: questionnaire.questions.map((q, i) => ({
          publicId: q.publicId?.startsWith('new-') ? null : q.publicId || null,
          orderIndex: i,
          type: q.type,
          label: q.label,
          helperText: q.helperText,
          isRequired: q.isRequired,
          isHidden: q.isHidden,
          config: q.config,
          mappedField: q.mappedField,
        })),
      });
      setQuestionnaire(updated);
      savedSnapshot.current = getSnapshot(updated);
      addToast(t('questionnaire.saved'), 'success');
    } catch {
      addToast(t('questionnaire.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }, [questionnaire, addToast, t]);

  // Expose save to parent
  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

  const updateLocal = useCallback(
    (updater: (prev: QuestionnaireDto) => QuestionnaireDto) => {
      setQuestionnaire((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
    },
    [],
  );

  const handleAddSection = () => {
    const newSection: QuestionDto = {
      publicId: `new-${Date.now()}`,
      orderIndex: questionnaire?.questions.length ?? 0,
      type: 'section',
      label: '',
      helperText: null,
      isRequired: false,
      isHidden: false,
      config: null,
      mappedField: null,
    };
    updateLocal((prev) => ({
      ...prev,
      questions: [...prev.questions, newSection],
    }));
  };

  const handleAddQuestion = () => {
    const newQuestion: QuestionDto = {
      publicId: `new-${Date.now()}`,
      orderIndex: questionnaire?.questions.length ?? 0,
      type: 'short_text',
      label: '',
      helperText: null,
      isRequired: false,
      isHidden: false,
      config: null,
      mappedField: null,
    };
    updateLocal((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  };

  const handleQuestionChange = (index: number, updated: QuestionDto) => {
    updateLocal((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? updated : q)),
    }));
  };

  const handleQuestionRemove = (index: number) => {
    updateLocal((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleDragEnd: React.ComponentProps<typeof DragDropProvider>['onDragEnd'] = (event) => {
    if (event.canceled) return;
    const source = event.operation.source as { sortable?: { initialIndex: number } } | null;
    const target = event.operation.target as { sortable?: { index: number } } | null;
    const fromIndex = source?.sortable?.initialIndex;
    const toIndex = target?.sortable?.index;
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return;

    updateLocal((prev) => {
      const questions = [...prev.questions];
      const [moved] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, moved);
      return { ...prev, questions };
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        {t('common.loading')}
      </div>
    );
  }

  if (!questionnaire) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
      {/* ══ LEFT: Editor ══ */}
      <div>
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', marginBottom: 12,
            border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 12, fontFamily: 'inherit',
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
        >
          ← {t('questionnaire.backToList')}
        </button>

        {/* Title */}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">{t('questionnaire.titleLabel')}</label>
          <input
            className="form-input"
            value={questionnaire.title}
            onChange={(e) => updateLocal((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t('questionnaire.titlePlaceholder')}
            style={{ fontSize: 16, fontWeight: 600, padding: '8px 10px' }}
          />
        </div>

        {/* Description */}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">{t('questionnaire.descriptionLabel')}</label>
          <textarea
            className="form-input"
            value={questionnaire.description ?? ''}
            onChange={(e) => updateLocal((prev) => ({ ...prev, description: e.target.value || null }))}
            placeholder={t('questionnaire.descriptionPlaceholder')}
            rows={2}
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Active toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('questionnaire.activeToggle')}</span>
          <button
            type="button"
            className={`toggle${questionnaire.isActive ? ' on' : ''}`}
            onClick={() => updateLocal((prev) => ({ ...prev, isActive: !prev.isActive }))}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Default toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '8px 0' }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('questionnaire.defaultToggle')}</span>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{t('questionnaire.defaultHint')}</div>
          </div>
          <button
            type="button"
            className={`toggle${questionnaire.isDefault ? ' on' : ''}`}
            onClick={() => updateLocal((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="divider" style={{ marginBottom: 16 }} />

        {/* Questions list */}
        <DragDropProvider onDragEnd={handleDragEnd}>
          {questionnaire.questions.map((q, index) => {
            const id = q.publicId || `new-${index}`;
            return (
              <SortableQuestionCard
                key={id}
                id={id}
                index={index}
                question={q}
                onChange={(updated) => handleQuestionChange(index, updated)}
                onRemove={() => handleQuestionRemove(index)}
                defaultExpanded={q.publicId?.startsWith('new-')}
              />
            );
          })}
        </DragDropProvider>

        {/* Add question button */}
        <button
          type="button"
          onClick={handleAddQuestion}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '7px 14px',
            border: '1px dashed var(--border-md)',
            borderRadius: 'var(--radius-md)',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 13,
            fontFamily: 'inherit',
            transition: 'color 0.1s, border-color 0.1s',
            marginTop: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
        >
          + {t('questionnaire.addQuestion')}
        </button>
        <button
          type="button"
          onClick={handleAddSection}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '7px 14px',
            border: '1px dashed var(--border-md)',
            borderRadius: 'var(--radius-md)',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 13,
            fontFamily: 'inherit',
            transition: 'color 0.1s, border-color 0.1s',
            marginTop: 4,
            marginLeft: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
        >
          + {t('questionnaire.addSection')}
        </button>
      </div>

      {/* ══ RIGHT: Live Preview ══ */}
      <div style={{ position: 'sticky', top: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
          {t('questionnaire.previewTitle')}
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, minHeight: 200 }}>
          <QuestionnairePreview questionnaire={questionnaire} />
        </div>
      </div>
    </div>
  );
});
