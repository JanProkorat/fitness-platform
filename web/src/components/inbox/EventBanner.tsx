import { useTranslation } from 'react-i18next';
import ClientRequestCard from '@/components/inbox/cards/ClientRequestCard';
import InviteCard from '@/components/inbox/cards/InviteCard';
import ProposalSentCard from '@/components/inbox/cards/ProposalSentCard';
import { getEventPreviewText } from '@/lib/chatEvents';
import { isOriginEvent } from '@/lib/cooperationCards';
import { ChatEventType } from '@/api/generated';
import type { LinkCapabilityScope, MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  isOwn: boolean;
  participantName: string;
  /** Newest Accepted/Declined/Withdrawn event folded into this card, when loaded. */
  followUp?: MessageDto;
  /** Newest answer to the same request whichever card it folded into, to tell who answered. */
  sourceFollowUp?: MessageDto;
  /** Scope of the invite when this card is the conversation's newest cooperation. */
  requestedScope?: LinkCapabilityScope;
}

/**
 * One cooperation-event row in the thread. An Invited, Requested or ProposalSent
 * event whose source still resolves renders as a card (coach invite and proposal
 * on the right, client request on the left) that reads its own `eventStatus`.
 * Every other event, including old rows with no `eventSourceId`, keeps the
 * centered grey pill built client-side from `eventType` + `isOwn` + the
 * participant's name; the server's `Text` is never read here.
 */
export default function EventBanner({ message, isOwn, participantName, followUp, sourceFollowUp, requestedScope }: Props) {
  const { t } = useTranslation();

  if (isOriginEvent(message) && message.eventStatus) {
    switch (message.eventType) {
      case ChatEventType.Invited:
        return (
          <InviteCard
            message={message}
            status={message.eventStatus}
            participantName={participantName}
            requestedScope={requestedScope}
            followUp={followUp}
          />
        );
      case ChatEventType.ProposalSent:
        return (
          <ProposalSentCard
            message={message}
            status={message.eventStatus}
            participantName={participantName}
            followUp={followUp}
          />
        );
      default:
        return (
          <ClientRequestCard
            message={message}
            status={message.eventStatus}
            participantName={participantName}
            followUp={followUp}
            sourceFollowUp={sourceFollowUp}
          />
        );
    }
  }

  const label = getEventPreviewText(t, message.eventType, isOwn, participantName);

  return (
    <div className="flex w-full justify-center">
      <span className="max-w-105 rounded-full border border-border bg-card px-3 py-1.25 text-center text-meta text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
