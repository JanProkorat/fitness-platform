import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dumbbell, Package } from 'lucide-react';
import CooperationCardShell, { type CardLabelTone } from '@/components/inbox/cards/CooperationCardShell';
import InviteReviewDrawer from '@/components/inbox/invite-review/InviteReviewDrawer';
import { Button } from '@/components/ui/button';
import { useIncomingRequests } from '@/hooks/useClientsQueries';
import { formatCardDate, formatSentWhen, firstName, formatServices, useHeldServices } from '@/lib/cooperationCards';
import { useAuthStore } from '@/stores/auth';
import { ChatEventType, CooperationCardStatus } from '@/api/generated';
import type { MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  status: CooperationCardStatus;
  participantName: string;
  /** The newest Accepted/Declined/Withdrawn event folded into this card, when loaded. */
  followUp?: MessageDto;
  /** The newest answer to this request, whichever card it folded into; tells who accepted or declined. */
  sourceFollowUp?: MessageDto;
}

/**
 * The incoming client-request card in the thread: the requested package (or
 * "Not chosen") and a "View invite" action while the request is pending, then
 * the same card with only its label and sub-line changed. Answering happens in
 * the review drawer. The card reads its own `eventStatus`, never the conversation's.
 */
export default function ClientRequestCard({ message, status, participantName, followUp, sourceFollowUp }: Props) {
  const { t, i18n } = useTranslation();
  const services = useHeldServices();
  const ownId = useAuthStore((state) => state.user?.publicId);
  const [reviewOpen, setReviewOpen] = useState(false);
  const sourceId = message.eventSourceId ?? '';
  const isPending = status === CooperationCardStatus.Pending;
  // Only a pending card shows the package, and the list is already loaded for the panel beside the thread.
  const requestsQuery = useIncomingRequests(isPending);
  const request = requestsQuery.data?.find((candidate) => candidate.publicId === sourceId);
  const name = firstName(participantName);

  const serviceLine = formatServices(t, services);
  const followUpDate = followUp?.timestamp ? formatCardDate(followUp.timestamp, i18n.language) : '';
  const withDate = (text: string) => (followUpDate ? `${text} · ${followUpDate}` : text);
  // The client answers a proposal, so an answer from someone other than the coach is theirs.
  const answeredByClient = sourceFollowUp !== undefined && sourceFollowUp.senderId !== ownId;

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
      subtitle = withDate(
        answeredByClient && sourceFollowUp?.eventType === ChatEventType.Accepted
          ? t('inbox.card.request.clientAcceptedProposal', { name })
          : t('inbox.card.request.youAccepted'),
      );
      break;
    case CooperationCardStatus.Declined:
      label = t('inbox.card.request.label.declined');
      subtitle = withDate(
        answeredByClient && sourceFollowUp?.eventType === ChatEventType.Declined
          ? t('inbox.card.request.clientDeclinedProposal', { name })
          : t('inbox.card.request.youDeclined'),
      );
      break;
    default:
      label = t('inbox.card.request.label.cancelled');
      subtitle = withDate(t('inbox.card.request.clientCancelled', { name }));
      break;
  }

  return (
    <>
      <CooperationCardShell
        align="incoming"
        icon={<Dumbbell className="size-4.75" aria-hidden="true" />}
        iconTone="request"
        label={label}
        labelTone={labelTone}
        hideLabel={isPending}
        title={title}
        subtitle={subtitle}
        testId="client-request-card"
        status={status}
        body={
          isPending && request ? (
            <div
              data-testid="client-request-card-package"
              className="flex items-center gap-2.5 rounded-field bg-sunken px-3 py-2.5 text-body"
            >
              <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">{t('inbox.card.request.package')}</span>
              <span className="ml-auto truncate font-semibold text-ink">
                {request.package?.name ?? t('inbox.card.request.packageNotChosen')}
              </span>
            </div>
          ) : undefined
        }
        actions={
          isPending ? (
            <Button
              type="button"
              className="h-9.5 flex-1 font-semibold"
              disabled={!sourceId}
              onClick={() => setReviewOpen(true)}
            >
              {t('inbox.card.request.viewInvite')}
            </Button>
          ) : undefined
        }
      />
      {isPending && sourceId && <InviteReviewDrawer requestId={sourceId} open={reviewOpen} onOpenChange={setReviewOpen} />}
    </>
  );
}
