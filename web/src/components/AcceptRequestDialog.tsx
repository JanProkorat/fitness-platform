import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { acceptClientRequest } from '@/api/client-requests';
import { getTrainerQuestionnaires, type QuestionnaireSummaryDto } from '@/api/questionnaires';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface AcceptRequestDialogProps {
  open: boolean;
  onClose: () => void;
  requestPublicId: string;
  clientName: string;
  statement?: string;
}

export function AcceptRequestDialog({ open, onClose, requestPublicId, clientName, statement }: AcceptRequestDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireSummaryDto[]>([]);

  // Load questionnaires when dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedQuestionnaireId('');
    (async () => {
      try {
        const data = await getTrainerQuestionnaires();
        setQuestionnaires(data);
        const defaultQ = data.find((q) => q.isDefault && q.isActive);
        setSelectedQuestionnaireId(defaultQ?.publicId ?? '');
      } catch {
        setQuestionnaires([]);
      }
    })();
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      acceptClientRequest(requestPublicId, selectedQuestionnaireId || null, statement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      onClose();
    },
  });

  const activeQuestionnaires = questionnaires.filter((q) => q.isActive);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('clientRequests.acceptTitle')}
      maxWidth={420}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('common.saving') : t('clientRequests.accept')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Client name */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
            {t('common.name')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
            {clientName}
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
          {t('clientRequests.acceptDescription')}
        </p>

        {/* Questionnaire selector */}
        <div>
          <label className="form-label">{t('clientRequests.selectQuestionnaire')}</label>
          <select
            className="form-select"
            value={selectedQuestionnaireId}
            onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
          >
            <option value="">{t('clientRequests.noQuestionnaire')}</option>
            {activeQuestionnaires.map((q) => (
              <option key={q.publicId} value={q.publicId}>
                {q.title}{q.isDefault ? ` (${t('questionnaire.default')})` : ''}
              </option>
            ))}
          </select>
        </div>

        {mutation.isError && (
          <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>
            {t('common.error')}
          </p>
        )}
      </div>
    </Dialog>
  );
}
