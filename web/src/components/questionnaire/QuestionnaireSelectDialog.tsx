import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrainerQuestionnaires } from '@/api/questionnaires';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

interface QuestionnaireSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (questionnairePublicId: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  icon: string;
}

export function QuestionnaireSelectDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  isPending,
  icon,
}: QuestionnaireSelectDialogProps) {
  const { t } = useTranslation();
  const [selectedQId, setSelectedQId] = useState('');
  const [trackedOpen, setTrackedOpen] = useState(false);

  const questionnairesQuery = useQuery({
    queryKey: ['trainer-questionnaires'],
    queryFn: getTrainerQuestionnaires,
    enabled: open,
  });

  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (!open) setSelectedQId('');
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          <div className="flex items-center justify-center" style={{ height: 90, background: 'var(--accent-bg)', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 36, opacity: 0.6 }}>{icon}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{description}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            <div>
              <label className="mb-1 block text-xs font-medium text-text3">{t('questionnaire.selectQuestionnaire')}</label>
              <select
                value={selectedQId}
                onChange={(e) => setSelectedQId(e.target.value)}
                className="rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full"
                style={{ fontFamily: 'inherit' }}
              >
                <option value="">{t('questionnaire.selectPlaceholder')}</option>
                {questionnairesQuery.data?.filter(q => q.isActive).map((q) => (
                  <option key={q.publicId} value={q.publicId}>
                    {q.title} ({q.questionCount} {t('questionnaire.questions')})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (selectedQId) onConfirm(selectedQId); }}
              disabled={!selectedQId || isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
