import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast';
import { Dialog, Button } from '@/components/ui';
import {
  getTrainerQuestionnaires,
  createQuestionnaire,
  deleteQuestionnaire,
  type QuestionnaireSummaryDto,
} from '@/api/questionnaires';

interface QuestionnaireListProps {
  onSelect: (publicId: string) => void;
}

export function QuestionnaireList({ onSelect }: QuestionnaireListProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getTrainerQuestionnaires();
      setQuestionnaires(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      const data = await createQuestionnaire(t('questionnaire.createTitle'));
      addToast(t('questionnaire.created'), 'success');
      onSelect(data.publicId);
    } catch {
      addToast(t('questionnaire.saveError'), 'error');
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<QuestionnaireSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuestionnaire(deleteTarget.publicId);
      setQuestionnaires((prev) => prev.filter((q) => q.publicId !== deleteTarget.publicId));
      addToast(t('questionnaire.deleted'), 'success');
      setDeleteTarget(null);
    } catch {
      addToast(t('questionnaire.saveError'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        {t('common.loading')}
      </div>
    );
  }

  if (questionnaires.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>
          {t('questionnaire.emptyState')}
        </div>
        <button
          type="button"
          className="rounded-md bg-text px-5 py-2 text-[13px] font-medium text-bg"
          onClick={handleCreate}
        >
          {t('questionnaire.create')}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Questionnaire cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questionnaires.map((q) => (
          <button
            key={q.publicId}
            type="button"
            onClick={() => onSelect(q.publicId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              width: '100%',
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.title}
                </span>
                {q.isDefault && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                    color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-br)',
                    flexShrink: 0,
                  }}>
                    {t('questionnaire.default')}
                  </span>
                )}
                {!q.isActive && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                    color: 'var(--text3)', background: 'var(--bg3)',
                    flexShrink: 0,
                  }}>
                    {t('questionnaire.inactive')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {q.questionCount} {t('questionnaire.questionsCount')}
                {q.description && <span> · {q.description}</span>}
              </div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteTarget(q); } }}
              style={{
                width: 24, height: 24, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                color: 'var(--text4)', fontSize: 12, transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; e.currentTarget.style.background = 'none'; }}
            >
              ✕
            </span>
          </button>
        ))}
      </div>

      {/* Add questionnaire button */}
      <button
        type="button"
        onClick={handleCreate}
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
          marginTop: 12,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
      >
        + {t('questionnaire.create')}
      </button>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('questionnaire.deleteTitle')}
        maxWidth={400}
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('common.saving') : t('questionnaire.deleteConfirm')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('questionnaire.deleteMessage', { title: deleteTarget?.title })}
        </p>
      </Dialog>
    </div>
  );
}
