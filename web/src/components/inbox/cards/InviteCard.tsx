import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import CooperationCardShell, { type CardLabelTone } from '@/components/inbox/cards/CooperationCardShell';
import { Button } from '@/components/ui/button';
import { useCancelPendingInvite } from '@/hooks/useClientsQueries';
import {
  INVITE_VALIDITY_DAYS,
  firstName,
  formatCardDate,
  formatServices,
  inviteDaysLeft,
  resolveInviteServices,
  useHeldServices,
} from '@/lib/cooperationCards';
import { CooperationCardStatus } from '@/api/generated';
import type { LinkCapabilityScope, MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  status: CooperationCardStatus;
  participantName: string;
  /** The invite's requested scope when this is the conversation's newest cooperation; otherwise null. */
  requestedScope?: LinkCapabilityScope;
  /** The newest Accepted/Declined/Withdrawn event for this invite, when loaded. */
  followUp?: MessageDto;
}

/**
 * The outgoing coach-invite card: it stays in the thread and only its label
 * changes (Sent, Accepted, Declined, Cancelled, Expired). "Cancel invite"
 * shows while the invite is pending. Reads its own `eventStatus`.
 */
export default function InviteCard({ message, status, participantName, requestedScope, followUp }: Props) {
  const { t, i18n } = useTranslation();
  const held = useHeldServices();
  const cancelMutation = useCancelPendingInvite();
  const sourceId = message.eventSourceId ?? '';

  const services = resolveInviteServices(requestedScope, held);
  const title = [participantName, formatServices(t, services)].filter(Boolean).join(' · ');
  const name = firstName(participantName);
  const followUpDate = followUp?.timestamp ? formatCardDate(followUp.timestamp, i18n.language) : '';
  const withDate = (text: string) => (followUpDate ? `${text} · ${followUpDate}` : text);

  let label: string;
  let labelTone: CardLabelTone = 'muted';
  let subtitle: string;
  switch (status) {
    case CooperationCardStatus.Pending: {
      label = t('inbox.card.invite.label.sent');
      const sentDate = message.timestamp ? formatCardDate(message.timestamp, i18n.language) : '';
      const days = message.timestamp ? inviteDaysLeft(message.timestamp) : INVITE_VALIDITY_DAYS;
      const expires = days === 0 ? t('inbox.card.invite.expiresToday') : t('inbox.card.invite.expiresIn', { count: days });
      subtitle = [sentDate && t('inbox.card.invite.sent', { when: sentDate }), expires].filter(Boolean).join(' · ');
      break;
    }
    case CooperationCardStatus.Accepted:
      label = t('inbox.card.invite.label.accepted');
      labelTone = 'success';
      subtitle = withDate(t('inbox.card.invite.accepted', { name }));
      break;
    case CooperationCardStatus.Declined:
      label = t('inbox.card.invite.label.declined');
      subtitle = withDate(t('inbox.card.invite.declined', { name }));
      break;
    case CooperationCardStatus.Cancelled:
      label = t('inbox.card.invite.label.cancelled');
      subtitle = withDate(t('inbox.card.invite.youCancelled'));
      break;
    default:
      label = t('inbox.card.invite.label.expired');
      subtitle = t('inbox.card.invite.noAnswer', { count: INVITE_VALIDITY_DAYS });
      break;
  }

  return (
    <CooperationCardShell
      align="outgoing"
      icon={<Send className="size-4.75" aria-hidden="true" />}
      iconTone="invite"
      label={label}
      labelTone={labelTone}
      title={title}
      subtitle={subtitle}
      testId="invite-card"
      status={status}
      actions={
        status === CooperationCardStatus.Pending ? (
          <Button
            type="button"
            variant="outline"
            className="h-8.5 flex-1 font-semibold"
            disabled={!sourceId || cancelMutation.isPending}
            onClick={() => cancelMutation.mutate(sourceId)}
          >
            {cancelMutation.isPending ? t('common.saving') : t('inbox.card.invite.cancel')}
          </Button>
        ) : undefined
      }
    />
  );
}
