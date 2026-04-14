import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createPendingInvite } from '@/api/pending-invites';
import { getTrainerQuestionnaires, type QuestionnaireSummaryDto } from '@/api/questionnaires';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';

interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewClientDialog({ open, onClose }: NewClientDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);

  useEffect(() => {
    if (!open) return;
    setEmail(''); setFirstName(''); setLastName(''); setMessage(''); setSelectedQuestionnaireId('');
    getTrainerQuestionnaires().then((data) => {
      setQuestionnaires(data);
      const defaultQ = data.find((q) => q.isDefault && q.isActive);
      setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
    }).catch(() => setQuestionnaires([]));
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createPendingInvite({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        message: message.trim() || null,
        questionnairePublicId: selectedQuestionnaireId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      onClose();
    },
  });

  const activeQuestionnaires = questionnaires.filter((q) => q.isActive);
  const canSend = email.trim() && firstName.trim() && lastName.trim();

  if (!open) return null;

  const inp = 'rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          {/* Hero */}
          <div className="flex items-center justify-center" style={{ height: 90, background: 'var(--accent-bg)', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 36, opacity: 0.6 }}>✉️</span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{t('invite.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('invite.description')}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            <div className="flex flex-col gap-4">
              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">{t('profile.firstName')}</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jan" className={inp} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">{t('profile.lastName')}</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Novák" className={inp} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@example.cz" className={inp} />
              </div>

              {/* Introduction message */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">
                  {t('invite.message')} <span className="font-normal" style={{ color: 'var(--text4)' }}>({t('common.optional')})</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('invite.messagePlaceholder')}
                  rows={3}
                  maxLength={500}
                  className={`${inp} resize-vertical`}
                />
                <div className="text-[10px] text-text4 text-right mt-0.5">{message.length}/500</div>
              </div>

              {/* Questionnaire selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">{t('invite.questionnaire')}</label>
                <select
                  value={selectedQuestionnaireId}
                  onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                  className={inp}
                  style={{ fontFamily: 'inherit' }}
                >
                  <option value="">{t('invite.noQuestionnaire')}</option>
                  {activeQuestionnaires.map((q) => (
                    <option key={q.publicId} value={q.publicId}>
                      {q.title}{q.isDefault ? ` (${t('questionnaire.default')})` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-text3 mt-1">{t('invite.questionnaireHint')}</div>
              </div>

              {mutation.isError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{t('invite.error')}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border" style={{ flexShrink: 0 }}>
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (canSend) mutation.mutate(); }}
              disabled={mutation.isPending || !canSend}
              className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {mutation.isPending ? t('invite.sending') : t('invite.send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
