import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getClientQuestionnaireResponses,
  getTrainerQuestionnaires,
  assignQuestionnaire,
  cancelQuestionnaire,
  replaceQuestionnaire,
  type ClientResponseItem,
  type ResponseAnswerDto,
} from '@/api/questionnaires';

interface Props {
  clientId: string;
  questionnaireResponseId?: string | null;
  planStatus: string;
  /** i18n namespace prefix — 'nutrition' or 'training' */
  ns: 'nutrition' | 'training';
}

function formatAnswerValue(answer: ResponseAnswerDto): React.ReactNode {
  switch (answer.questionType) {
    case 'short_text':
    case 'single_choice':
      return answer.valueText ?? '—';
    case 'multi_select': {
      if (!answer.valueJson) return '—';
      try {
        const arr = JSON.parse(answer.valueJson) as string[];
        return Array.isArray(arr) ? arr.join(', ') : answer.valueJson;
      } catch {
        return answer.valueJson;
      }
    }
    case 'number':
      return answer.valueNumber != null ? String(answer.valueNumber) : '—';
    case 'scale':
      return answer.valueNumber != null ? `${answer.valueNumber} / 10` : '—';
    case 'file_upload':
      if (!answer.fileUrl) return '—';
      return (
        <a
          href={answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--blue)', textDecoration: 'underline', fontSize: 11 }}
        >
          {answer.fileUrl.split('/').pop()}
        </a>
      );
    default:
      return answer.valueText ?? answer.valueNumber?.toString() ?? '—';
  }
}

// ─── Questionnaire Select Dialog ────────────────────────────────────

function QuestionnaireSelectDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  isPending,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (questionnairePublicId: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  icon: string;
}) {
  const { t } = useTranslation();
  const [selectedQId, setSelectedQId] = useState('');

  const questionnairesQuery = useQuery({
    queryKey: ['trainer-questionnaires'],
    queryFn: getTrainerQuestionnaires,
    enabled: open,
  });

  useEffect(() => { if (!open) setSelectedQId(''); }, [open]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes dlg-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dlg-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
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
            <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-medium text-text3 hover:bg-bg-hover transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (selectedQId) onConfirm(selectedQId); }}
              disabled={!selectedQId || isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Revoke Confirmation Dialog ─────────────────────────────────────

function RevokeConfirmDialog({
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes dlg-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dlg-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} style={{ animation: 'dlg-fade-in .4s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[5vh] pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col border border-border shadow-2xl overflow-hidden"
          style={{ width: 440, maxWidth: '95vw', background: 'var(--bg)', borderRadius: 10, animation: 'dlg-slide-up .4s ease-out' }}
        >
          <div className="flex items-center justify-center" style={{ height: 80, background: 'var(--red-bg, rgba(255,59,48,0.08))', borderRadius: '10px 10px 0 0' }}>
            <span style={{ fontSize: 32, opacity: 0.7 }}>🗑️</span>
          </div>
          <div className="px-5 py-4">
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('questionnaire.revokeConfirmTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{t('questionnaire.revokeConfirmDesc')}</div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-[13px] font-medium text-text3 hover:bg-bg-hover transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="px-5 py-2 rounded-md text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--red)' }}
            >
              {isPending ? t('questionnaire.revoking') : t('questionnaire.revokeQuestionnaire')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Sidebar panel showing linked questionnaire on a plan detail page.
 * - Linked: shows questionnaire title + expandable answers
 * - Pending: shows waiting indicator + replace/revoke buttons
 * - Empty: shows "Send questionnaire" button
 */
export function PlanQuestionnairePanel({
  clientId,
  questionnaireResponseId,
  planStatus,
  ns,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.language === 'cs' ? 'cs-CZ' : i18n.language === 'de' ? 'de-DE' : 'en-GB';
  const [answersOpen, setAnswersOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const canEdit = planStatus !== 'Completed' && planStatus !== 'Archived';

  const { data } = useQuery({
    queryKey: ['questionnaire-responses', clientId],
    queryFn: () => getClientQuestionnaireResponses(clientId),
    enabled: !!clientId,
  });

  const responses = data?.responses ?? [];
  const submitted = responses.filter((r) => r.status === 'Submitted');
  const pendingResponse = responses.find((r) => r.status === 'Pending' || r.status === 'InProgress');
  const hasPending = !!pendingResponse;
  // Show the linked response if the plan has a questionnaireResponseId,
  // otherwise fall back to the latest submitted response (submitted but
  // not yet explicitly linked to the plan).
  const linked: ClientResponseItem | undefined = questionnaireResponseId
    ? submitted.find((r) => r.responsePublicId === questionnaireResponseId)
    : submitted[0];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['questionnaire-responses', clientId] });
    queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
  };

  const assignMutation = useMutation({
    mutationFn: (qId: string) => assignQuestionnaire(clientId, qId),
    onSuccess: () => { setSendDialogOpen(false); invalidateAll(); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelQuestionnaire(clientId),
    onSuccess: () => { setRevokeOpen(false); invalidateAll(); },
  });

  const replaceMutation = useMutation({
    mutationFn: (qId: string) => replaceQuestionnaire(clientId, qId),
    onSuccess: () => { setReplaceOpen(false); invalidateAll(); },
  });

  return (
    <div className="p-3 border-t border-border">
      <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
        {t(`${ns}.linkedQuestionnaire`)}
      </div>

      {linked ? (
        /* ── Linked state: show questionnaire title + expandable answers ── */
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              background: 'var(--accent-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent-br, rgba(201,168,76,0.2))',
              marginBottom: 6,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {linked.questionnaireTitle}
              </div>
              {linked.submittedAt && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                  {new Date(linked.submittedAt).toLocaleDateString(locale)}
                </div>
              )}
            </div>
          </div>

          {/* View answers toggle */}
          {linked.answers.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAnswersOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontFamily: 'inherit',
                  padding: '2px 0',
                  transition: 'opacity 0.1s',
                }}
              >
                <span style={{ transform: answersOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
                {t(`${ns}.viewAnswers`)} ({linked.answers.length})
              </button>
              {answersOpen && (
                <div
                  style={{
                    marginTop: 6,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  {linked.answers.map((answer, idx) => (
                    <div
                      key={answer.questionPublicId}
                      style={{
                        padding: '5px 8px',
                        borderBottom: idx < linked.answers.length - 1 ? '1px solid var(--border)' : 'none',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ color: 'var(--text3)', marginBottom: 1 }}>
                        {answer.questionLabel}
                      </div>
                      <div style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {formatAnswerValue(answer)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : hasPending ? (
        /* ── Pending state: waiting indicator + replace/revoke buttons ── */
        <div>
          <div style={{
            padding: '6px 8px',
            background: 'var(--orange-bg, rgba(255,149,0,0.08))',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(173,87,0,0.15)',
            fontSize: 11,
            color: 'var(--orange)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
          }}>
            <span>⏳</span>
            <span style={{ flex: 1 }}>
              {pendingResponse.questionnaireTitle
                ? t('questionnaire.waitingForResponseWithTitle', { title: pendingResponse.questionnaireTitle })
                : t('questionnaire.waitingForResponse')}
            </span>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setReplaceOpen(true)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {t('questionnaire.replaceQuestionnaire')}
              </button>
              <button
                type="button"
                onClick={() => setRevokeOpen(true)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--red-bg, rgba(255,59,48,0.08))',
                  color: 'var(--red)',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {t('questionnaire.revokeQuestionnaire')}
              </button>
            </div>
          )}

          <RevokeConfirmDialog
            open={revokeOpen}
            onClose={() => setRevokeOpen(false)}
            onConfirm={() => cancelMutation.mutate()}
            isPending={cancelMutation.isPending}
          />

          <QuestionnaireSelectDialog
            open={replaceOpen}
            onClose={() => setReplaceOpen(false)}
            onConfirm={(qId) => replaceMutation.mutate(qId)}
            title={t('questionnaire.replaceQuestionnaireTitle')}
            description={t('questionnaire.replaceQuestionnaireDesc')}
            confirmLabel={replaceMutation.isPending ? t('questionnaire.replacing') : t('questionnaire.replaceQuestionnaire')}
            isPending={replaceMutation.isPending}
            icon="🔄"
          />
        </div>
      ) : canEdit ? (
        /* ── Empty state: send questionnaire button ── */
        <>
          <button
            type="button"
            onClick={() => setSendDialogOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              width: '100%',
              padding: '6px 0',
              border: '1px dashed var(--border-md)',
              borderRadius: 'var(--radius-md)',
              background: 'none',
              color: 'var(--text3)',
              fontSize: 11,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-md)';
              e.currentTarget.style.color = 'var(--text3)';
            }}
          >
            📋 {t('questionnaire.sendQuestionnaire')}
          </button>

          <QuestionnaireSelectDialog
            open={sendDialogOpen}
            onClose={() => setSendDialogOpen(false)}
            onConfirm={(qId) => assignMutation.mutate(qId)}
            title={t('questionnaire.sendQuestionnaireTitle')}
            description={t('questionnaire.sendQuestionnaireDesc')}
            confirmLabel={assignMutation.isPending ? t('questionnaire.sending') : t('questionnaire.sendQuestionnaire')}
            isPending={assignMutation.isPending}
            icon="📋"
          />
        </>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text4)', fontStyle: 'italic' }}>
          —
        </div>
      )}
    </div>
  );
}
