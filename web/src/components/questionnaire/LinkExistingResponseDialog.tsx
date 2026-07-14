import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientResponseItem } from '@/api/questionnaires';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

interface LinkExistingResponseDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (responsePublicId: string) => void;
  /** Submitted responses eligible for linking (caller pre-filters to status === 'Submitted'). */
  responses: ClientResponseItem[];
  isPending: boolean;
  /** i18n namespace prefix — 'nutrition' or 'training'. Reuses the existing
   * linkQuestionnaire/selectQuestionnaire/noSubmittedResponses keys that
   * already exist in both namespaces (added ahead of this UI but never
   * wired up — #777). */
  ns: 'nutrition' | 'training';
}

/**
 * Lets a trainer/nutritionist explicitly link an already-submitted
 * questionnaire response to the current plan (#777 AC5 — retroactive
 * linking). Distinct from `QuestionnaireSelectDialog`, which picks a
 * *template* to send; this picks an already-*submitted response*.
 */
export function LinkExistingResponseDialog({
  open,
  onClose,
  onConfirm,
  responses,
  isPending,
  ns,
}: LinkExistingResponseDialogProps) {
  const { t, i18n } = useTranslation();
  const [selectedId, setSelectedId] = useState('');
  const [trackedOpen, setTrackedOpen] = useState(false);
  const locale = i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (!open) setSelectedId('');
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
            <span style={{ fontSize: 36, opacity: 0.6 }}>🔗</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t(`${ns}.linkQuestionnaire`)}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t(`${ns}.selectQuestionnaire`)}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            {responses.length === 0 ? (
              <div className="text-[13px] text-text3">{t(`${ns}.noSubmittedResponses`)}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {responses.map((r) => (
                  <label
                    key={r.responsePublicId}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors"
                    style={{
                      borderColor: selectedId === r.responsePublicId ? 'var(--accent)' : 'var(--border)',
                      background: selectedId === r.responsePublicId ? 'var(--accent-bg)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="link-existing-response"
                      value={r.responsePublicId}
                      checked={selectedId === r.responsePublicId}
                      onChange={() => setSelectedId(r.responsePublicId)}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="text-[13px] font-medium text-text truncate">{r.questionnaireTitle}</div>
                      {r.submittedAt && (
                        <div className="text-[11px] text-text3">
                          {new Date(r.submittedAt).toLocaleDateString(locale)}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (selectedId) onConfirm(selectedId); }}
              disabled={!selectedId || isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {isPending ? t('common.saving') : t(`${ns}.linkQuestionnaire`)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
