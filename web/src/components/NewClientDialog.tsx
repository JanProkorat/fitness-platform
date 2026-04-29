/**
 * NewClientDialog — invite a new client via email.
 *
 * The "Bundle photo diary" toggle (per invite-new.html prototype) is included.
 * When checked, the component fires POST /trainer/photo-diary-requests
 * (with pendingInviteId) immediately after the invite is created.
 * On diary failure the invite is already sent — a non-blocking warning toast
 * tells the user they can retry from the client detail page.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createPendingInvite } from '@/api/pending-invites';
import { createDiaryRequest } from '@/api/diary-requests';
import { getTrainerQuestionnaires } from '@/api/questionnaires';
import { CANCEL_BUTTON_CLASS } from '@/lib/styles';
import { showApiError } from '@/lib/api-errors';
import { useToastStore } from '@/stores/toast';
import i18n from '@/i18n';

const DURATION_OPTIONS = [3, 7, 14] as const;
type DurationDays = (typeof DURATION_OPTIONS)[number];

interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewClientDialog({ open, onClose }: NewClientDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');

  // Photo diary bundle state
  const [bundleDiary, setBundleDiary] = useState(false);
  const [diaryDurationDays, setDiaryDurationDays] = useState<DurationDays>(7);

  const [trackedOpen, setTrackedOpen] = useState(false);

  const { data: questionnaires = [] } = useQuery({
    queryKey: ['trainer-questionnaires'],
    queryFn: getTrainerQuestionnaires,
    enabled: open,
  });

  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setMessage('');
      setBundleDiary(false);
      setDiaryDurationDays(7);
      const defaultQ = questionnaires.find((q) => q.isDefault && q.isActive);
      setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      createPendingInvite({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        message: message.trim() || null,
        questionnairePublicId: selectedQuestionnaireId || null,
      }),
    onSuccess: async (inviteResponse) => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });

      if (bundleDiary && inviteResponse.id != null) {
        try {
          await createDiaryRequest({
            pendingInviteId: inviteResponse.id,
            durationDays: diaryDurationDays,
          });
        } catch {
          addToast(i18n.t('diary.request.inviteDiaryFailed'), 'error');
        }
      }

      onClose();
    },
    onError: (err) => {
      showApiError(err, 'invite.error');
    },
  });

  const activeQuestionnaires = questionnaires.filter((q) => q.isActive);
  const canSend = email.trim() && firstName.trim() && lastName.trim();

  if (!open) return null;

  const inp =
    'rounded-md border border-border-md bg-bg px-3 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text3 focus:border-border-hv w-full';

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        style={{ animation: 'dlg-fade-in .4s ease-out' }}
      />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{
            width: 480,
            maxWidth: '95vw',
            maxHeight: '90vh',
            background: 'var(--bg)',
            borderRadius: 10,
            animation: 'dlg-slide-up .4s ease-out',
          }}
        >
          {/* Hero */}
          <div
            className="flex items-center justify-center"
            style={{
              height: 90,
              background: 'var(--accent-bg)',
              borderRadius: '10px 10px 0 0',
            }}
          >
            <span style={{ fontSize: 36, opacity: 0.6 }}>✉️</span>
          </div>

          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-3 border-b border-border"
            style={{ flexShrink: 0 }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                {t('invite.title')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {t('invite.description')}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--text3)',
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            <div className="flex flex-col gap-4">
              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">
                    {t('profile.firstName')}
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jan"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text3">
                    {t('profile.lastName')}
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Novák"
                    className={inp}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jan@example.cz"
                  className={inp}
                />
              </div>

              {/* Introduction message */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">
                  {t('invite.message')}{' '}
                  <span className="font-normal" style={{ color: 'var(--text4)' }}>
                    ({t('common.optional')})
                  </span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('invite.messagePlaceholder')}
                  rows={3}
                  maxLength={500}
                  className={`${inp} resize-vertical`}
                />
                <div className="text-[10px] text-text4 text-right mt-0.5">
                  {message.length}/500
                </div>
              </div>

              {/* Questionnaire selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text3">
                  {t('invite.questionnaire')}
                </label>
                <select
                  value={selectedQuestionnaireId}
                  onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                  className={inp}
                  style={{ fontFamily: 'inherit' }}
                >
                  <option value="">{t('invite.noQuestionnaire')}</option>
                  {activeQuestionnaires.map((q) => (
                    <option key={q.publicId} value={q.publicId}>
                      {q.title}
                      {q.isDefault ? ` (${t('questionnaire.default')})` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-text3 mt-1">
                  {t('invite.questionnaireHint')}
                </div>
              </div>

              {/* ── Photo diary bundle (per invite-new.html prototype) ── */}
              <div
                className="rounded-md border overflow-hidden"
                style={{
                  borderColor: bundleDiary ? 'var(--accent-br)' : 'var(--border)',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Toggle row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center shrink-0 text-base"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: bundleDiary
                          ? 'var(--accent-bg)'
                          : 'var(--bg3)',
                      }}
                    >
                      📸
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {t('diary.request.inviteCheckboxLabel')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
                        {t('diary.request.inviteCheckboxHint')}
                      </div>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bundleDiary}
                    onClick={() => setBundleDiary((v) => !v)}
                    className="shrink-0 ml-3"
                    style={{
                      width: 44,
                      height: 26,
                      borderRadius: 13,
                      background: bundleDiary ? 'var(--accent)' : 'var(--bg3)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: bundleDiary ? 21 : 3,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                </div>

                {/* Expanded fields — shown when bundleDiary is on */}
                {bundleDiary && (
                  <div
                    className="border-t px-4 pb-4 pt-3 flex flex-col gap-3"
                    style={{ borderColor: 'var(--accent-br)', background: 'var(--accent-bg)' }}
                  >
                    {/* Duration */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-text3">
                        {t('diary.request.durationLabel')}
                      </label>
                      <div className="flex gap-1.5">
                        {DURATION_OPTIONS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDiaryDurationDays(d)}
                            className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors"
                            style={{
                              background:
                                diaryDurationDays === d ? 'var(--accent)' : 'var(--bg)',
                              color:
                                diaryDurationDays === d ? '#fff' : 'var(--text3)',
                              borderColor:
                                diaryDurationDays === d ? 'var(--accent)' : 'var(--border)',
                            }}
                          >
                            {t('diary.request.durationDays', { count: d })}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {mutation.isError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>
                  {t('invite.error')}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
            style={{ flexShrink: 0 }}
          >
            <button onClick={onClose} className={CANCEL_BUTTON_CLASS}>
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                if (canSend) mutation.mutate();
              }}
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
