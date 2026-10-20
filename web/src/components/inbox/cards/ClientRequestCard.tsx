import { useTranslation } from 'react-i18next';
import { Check, Dumbbell } from 'lucide-react';
import CooperationCardShell, { type CardLabelTone } from '@/components/inbox/cards/CooperationCardShell';
import { Button } from '@/components/ui/button';
import { useAcceptClientRequest, useRejectClientRequest } from '@/hooks/useClientsQueries';
import { formatCardDate, formatSentWhen, firstName, formatServices, useHeldServices } from '@/lib/cooperationCards';
import { CooperationCardStatus } from '@/api/generated';
import type { MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  status: CooperationCardStatus;
  participantName: string;
  /** The newest Accepted/Declined/Withdrawn event for this request, when loaded. */
  followUp?: MessageDto;
}

/**
 * The incoming client-request card in the thread: Accept / Decline while the
 * request is pending, then the same card with only its label and sub-line
 * changed. The card reads its own `eventStatus`, never the conversation's.
 */
export default function ClientRequestCard({ message, status, participantName, followUp }: Props) {
  const { t, i18n } = useTranslation();
  const services = useHeldServices();
  const acceptMutation = useAcceptClientRequest();
  const rejectMutation = useRejectClientRequest();
  const sourceId = message.eventSourceId ?? '';
  const isBusy = acceptMutation.isPending || rejectMutation.isPending;

  const serviceLine = formatServices(t, services);
  const followUpDate = followUp?.timestamp ? formatCardDate(followUp.timestamp, i18n.language) : '';
  const withDate = (text: string) => (followUpDate ? `${text} · ${followUpDate}` : text);

  const titleKey =
    services.length === 1
      ? `inbox.card.request.title.${services[0]}`
      : 'inbox.card.request.title.both';
  const title = t(titleKey, { name: participantName });

  let label: string;
  let labelTone: CardLabelTone = 'muted';
  let subtitle: string;
  switch (status) {
    case CooperationCardStatus.Pending: {
      label = t('inbox.card.request.label.pending');
      labelTone = 'request';
      const sent = message.timestamp ? formatSentWhen(t, message.timestamp, i18n.language) : '';
      subtitle = [serviceLine, sent && t('inbox.card.request.sent', { when: sent })].filter(Boolean).join(' · ');
      break;
    }
    case CooperationCardStatus.Accepted:
      label = t('inbox.card.request.label.accepted');
      labelTone = 'success';
      subtitle = withDate(t('inbox.card.request.youAccepted'));
      break;
    case CooperationCardStatus.Declined:
      label = t('inbox.card.request.label.declined');
      subtitle = withDate(t('inbox.card.request.youDeclined'));
      break;
    default:
      label = t('inbox.card.request.label.cancelled');
      subtitle = withDate(t('inbox.card.request.clientCancelled', { name: firstName(participantName) }));
      break;
  }

  return (
    <CooperationCardShell
      align="incoming"
      icon={<Dumbbell className="size-4.75" aria-hidden="true" />}
      iconTone="request"
      label={label}
      labelTone={labelTone}
      title={title}
      subtitle={subtitle}
      testId="client-request-card"
      status={status}
      actions={
        status === CooperationCardStatus.Pending ? (
          <>
            <Button
              type="button"
              className="h-8.5 flex-1 font-semibold"
              disabled={!sourceId || isBusy}
              onClick={() => acceptMutation.mutate({ publicId: sourceId })}
            >
              {!acceptMutation.isPending && <Check aria-hidden="true" />}
              {acceptMutation.isPending ? t('common.saving') : t('inbox.card.request.accept')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8.5 flex-1 font-semibold"
              disabled={!sourceId || isBusy}
              onClick={() => rejectMutation.mutate({ publicId: sourceId })}
            >
              {rejectMutation.isPending ? t('common.saving') : t('inbox.card.request.decline')}
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
