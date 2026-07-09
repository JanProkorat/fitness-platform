import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getClientQuestionnaireResponses,
  assignQuestionnaire,
  cancelQuestionnaire,
  replaceQuestionnaire,
  type ClientResponseItem,
} from '@/api/questionnaires';
import { QuestionnaireSelectDialog } from './QuestionnaireSelectDialog';
import { RevokeConfirmDialog } from './RevokeConfirmDialog';
import { showApiError } from '@/lib/api-errors';

interface Props {
  clientId: string;
  questionnaireResponseId?: string | null;
  planStatus: string;
  /** i18n namespace prefix — 'nutrition' or 'training' */
  ns: 'nutrition' | 'training';
}

/**
 * Sidebar panel showing linked questionnaire on a plan detail page.
 * - Linked: shows questionnaire title + submitted date (answers themselves
 *   render in the page-level "Dotazník" tab via `QuestionnaireAnswersView`)
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
    onError: (err) => { showApiError(err, 'questionnaire.assignError'); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelQuestionnaire(clientId),
    onSuccess: () => { setRevokeOpen(false); invalidateAll(); },
    onError: (err) => { showApiError(err, 'questionnaire.cancelError'); },
  });

  const replaceMutation = useMutation({
    mutationFn: (qId: string) => replaceQuestionnaire(clientId, qId),
    onSuccess: () => { setReplaceOpen(false); invalidateAll(); },
    onError: (err) => { showApiError(err, 'questionnaire.replaceError'); },
  });

  return (
    <div className="p-3 border-t border-border">
      <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
        {t(`${ns}.linkedQuestionnaire`)}
      </div>

      {linked ? (
        /* ── Linked state: show questionnaire title + submitted date ── */
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              background: 'var(--accent-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent-br)',
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
        </div>
      ) : hasPending ? (
        /* ── Pending state: waiting indicator + replace/revoke buttons ── */
        <div>
          <div style={{
            padding: '6px 8px',
            background: 'var(--orange-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--orange-br)',
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
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                className="text-white"
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
                  background: 'var(--red-bg)',
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
