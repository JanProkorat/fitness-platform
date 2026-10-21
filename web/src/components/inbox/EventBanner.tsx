import { useTranslation } from 'react-i18next';
import ClientRequestCard from '@/components/inbox/cards/ClientRequestCard';
import InviteCard from '@/components/inbox/cards/InviteCard';
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
  /** Scope of the invite when this card is the conversation's newest cooperation. */
  requestedScope?: LinkCapabilityScope;
}

/**
 * One cooperation-event row in the thread. An Invited or Requested event whose
 * source still resolves renders as a card (coach invite on the right, client
 * request on the left) that reads its own `eventStatus`. Every other event,
 * including old rows with no `eventSourceId`, keeps the centered grey pill
 * built client-side from `eventType` + `isOwn` + the participant's name; the
 * server's `Text` is never read here.
 */
export default function EventBanner({ message, isOwn, participantName, followUp, requestedScope }: Props) {
  const { t } = useTranslation();

  if (isOriginEvent(message) && message.eventStatus) {
    return message.eventType === ChatEventType.Invited ? (
      <InviteCard
        message={message}
        status={message.eventStatus}
        participantName={participantName}
        requestedScope={requestedScope}
        followUp={followUp}
      />
    ) : (
      <ClientRequestCard message={message} status={message.eventStatus} participantName={participantName} followUp={followUp} />
    );
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
