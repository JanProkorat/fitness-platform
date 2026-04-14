import { useTranslation } from 'react-i18next';
import { Dialog, Button } from '@/components/ui';
import type { IncomingRequest } from '@/api/client-requests';
import type { PendingInviteDto } from '@/api/pending-invites';
import type { QuestionnaireSummaryDto } from '@/api/questionnaires';

interface ClientRequestDialogProps {
  isOpen: boolean;
  request: IncomingRequest | null;
  statementText: string;
  onStatementChange: (text: string) => void;
  selectedQuestionnaireId: string;
  onQuestionnaireChange: (id: string) => void;
  questionnaires: QuestionnaireSummaryDto[];
  onAccept: () => void;
  onReject: () => void;
  acceptPending: boolean;
  rejectPending: boolean;
  onClose: () => void;
}

export function ClientRequestDialog({
  isOpen,
  request,
  statementText,
  onStatementChange,
  selectedQuestionnaireId,
  onQuestionnaireChange,
  questionnaires,
  onAccept,
  onReject,
  acceptPending,
  rejectPending,
  onClose,
}: ClientRequestDialogProps) {
  const { t } = useTranslation();

  if (!request) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={t('clientRequests.title')}
      maxWidth={420}
      footer={
        <>
          <Button
            variant="danger"
            onClick={onReject}
            disabled={rejectPending}
          >
            {rejectPending ? t('common.loading') : t('clientRequests.reject')}
          </Button>
          <Button
            variant="primary"
            onClick={onAccept}
            disabled={acceptPending}
          >
            {acceptPending ? t('common.saving') : t('clientRequests.accept')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('common.name')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
            {request.clientFirstName} {request.clientLastName}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            Email
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            {request.clientEmail}
          </div>
        </div>
        {request.message && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
              {t('clientRequests.message')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              {request.message}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('clientRequests.sentAt')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            {new Date(request.sentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Questionnaire selector */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('clientRequests.selectQuestionnaire')}
          </div>
          <select
            value={selectedQuestionnaireId}
            onChange={(e) => onQuestionnaireChange(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              outline: 'none',
            }}
          >
            <option value="">{t('clientRequests.noQuestionnaire')}</option>
            {questionnaires.filter((q) => q.isActive).map((q) => (
              <option key={q.publicId} value={q.publicId}>
                {q.title}{q.isDefault ? ` (${t('questionnaire.default')})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Statement */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('clientRequests.statement')}
          </div>
          <textarea
            value={statementText}
            onChange={(e) => onStatementChange(e.target.value)}
            placeholder={t('clientRequests.statementPlaceholder')}
            maxLength={1000}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </Dialog>
  );
}

interface PendingInviteDialogProps {
  isOpen: boolean;
  invite: PendingInviteDto | null;
  deletePending: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export function PendingInviteDialog({
  isOpen,
  invite,
  deletePending,
  onDelete,
  onClose,
}: PendingInviteDialogProps) {
  const { t } = useTranslation();

  if (!invite) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={t('sidebar.pendingInvites')}
      maxWidth={400}
      footer={
        <>
          <Button
            variant="danger"
            onClick={onDelete}
            disabled={deletePending}
          >
            {deletePending ? t('common.loading') : t('sidebar.deleteInvite')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('common.name')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            {invite.firstName} {invite.lastName}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            Email
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            {invite.email}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('sidebar.sentAt')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            {new Date(invite.sentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text2)' }}>
          {t('sidebar.pendingInviteInfo')}
        </div>
      </div>
    </Dialog>
  );
}
