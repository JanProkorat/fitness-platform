import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import CooperationCardShell, { type CardLabelTone } from '@/components/inbox/cards/CooperationCardShell';
import InviteReviewDrawer from '@/components/inbox/invite-review/InviteReviewDrawer';
import { Button } from '@/components/ui/button';
import { billingSuffix } from '@/components/client-detail/payment/paymentModel';
import { toOfferPackage } from '@/components/offer/offerModel';
import { useIncomingRequests, useWithdrawClientRequestProposal } from '@/hooks/useClientsQueries';
import { formatCardDate, formatSentWhen, firstName } from '@/lib/cooperationCards';
import { formatMoney } from '@/lib/money';
import { CooperationCardStatus } from '@/api/generated';
import type { MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  status: CooperationCardStatus;
  participantName: string;
  /** The newest Accepted/Declined/Withdrawn event folded into this card, when loaded. */
  followUp?: MessageDto;
}

/**
 * The coach's package proposal in the thread, on the coach's side. While it waits it names the package and price
 * and offers "View invite" and "Withdraw"; once answered or withdrawn it stays as a plain "Package proposal"
 * line, because the event carries no package and only the open proposal is known to the request list.
 */
export default function ProposalSentCard({ message, status, participantName, followUp }: Props) {
  const { t, i18n } = useTranslation();
  const [reviewOpen, setReviewOpen] = useState(false);
  const sourceId = message.eventSourceId ?? '';
  const isWaiting = status === CooperationCardStatus.Pending;
  const requestsQuery = useIncomingRequests(isWaiting);
  const withdrawMutation = useWithdrawClientRequestProposal();
  const proposal = requestsQuery.data?.find((candidate) => candidate.publicId === sourceId)?.proposal;
  const proposedPackage = proposal?.package ? toOfferPackage(proposal.package) : undefined;
  const name = firstName(participantName);

  const followUpDate = followUp?.timestamp ? formatCardDate(followUp.timestamp, i18n.language) : '';
  const withDate = (text: string) => (followUpDate ? `${text} · ${followUpDate}` : text);

  let title = t('inbox.card.proposal.title');
  let labelTone: CardLabelTone = 'muted';
  let label: string;
  let subtitle: string;
  switch (status) {
    case CooperationCardStatus.Pending: {
      label = t('inbox.card.proposal.label.waiting');
      labelTone = 'success';
      const sent = message.timestamp ? formatSentWhen(t, message.timestamp, i18n.language) : '';
      const price = proposedPackage
        ? `${formatMoney(proposedPackage.price, proposedPackage.currency, i18n.language)} ${billingSuffix(t, proposedPackage.billing, proposedPackage.intervalWeeks)}`
        : '';
      if (proposedPackage) {
        title = t('inbox.card.proposal.youProposed', { name: proposedPackage.name });
      }
      subtitle = [price, sent && t('inbox.card.proposal.sent', { when: sent })].filter(Boolean).join(' · ');
      break;
    }
    case CooperationCardStatus.Accepted:
      label = t('inbox.card.proposal.label.accepted');
      labelTone = 'success';
      subtitle = withDate(t('inbox.card.proposal.accepted', { name }));
      break;
    case CooperationCardStatus.Declined:
      label = t('inbox.card.proposal.label.declined');
      subtitle = withDate(t('inbox.card.proposal.declined', { name }));
      break;
    default:
      label = t('inbox.card.proposal.label.withdrawn');
      subtitle = withDate(t('inbox.card.proposal.youWithdrew'));
      break;
  }

  return (
    <>
      <CooperationCardShell
        align="outgoing"
        icon={<Package className="size-4.75" aria-hidden="true" />}
        iconTone="proposal"
        label={label}
        labelTone={labelTone}
        hideLabel
        title={title}
        subtitle={subtitle}
        testId="proposal-sent-card"
        status={status}
        body={
          isWaiting ? (
            <p className="flex items-center gap-2 rounded-field bg-sunken px-3 py-2.5 text-body text-ink">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-marker-solid" />
              {t('inbox.card.proposal.waitingFor', { name })}
            </p>
          ) : (
            <p className="text-meta font-semibold text-muted-foreground">{label}</p>
          )
        }
        actions={
          isWaiting ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9.5 flex-1 font-semibold"
                disabled={!sourceId}
                onClick={() => setReviewOpen(true)}
              >
                {t('inbox.card.request.viewInvite')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9.5 flex-1 font-semibold"
                disabled={!sourceId || withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate(sourceId)}
              >
                {withdrawMutation.isPending ? t('common.saving') : t('inbox.card.proposal.withdraw')}
              </Button>
            </>
          ) : undefined
        }
      />
      {isWaiting && sourceId && <InviteReviewDrawer requestId={sourceId} open={reviewOpen} onOpenChange={setReviewOpen} />}
    </>
  );
}
