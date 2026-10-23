import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { ChatMessage, Conversation } from '@/api/conversations';
import { ChatEventType, CooperationCardStatus, LinkCapabilityScope } from '@/api/generated';
import { useInvites } from '@/hooks/useInvites';

import { EventCard } from './EventCard';
import type { EventCardDomain } from './EventCard';
import { cardExpiry, shortDate, sortedRoles } from './format';

type ChatEventCardProps = {
  conversation: Conversation;
  /** The Invited or Requested row. */
  message: ChatMessage;
  settledAt: string | undefined;
  own: boolean;
};

function domainOf(conversation: Conversation, sourceId: string): EventCardDomain {
  const cooperation = conversation.cooperation;
  if (cooperation?.sourceId === sourceId && cooperation.requestedScope) {
    if (cooperation.requestedScope === LinkCapabilityScope.Both) return 'both';
    return cooperation.requestedScope === LinkCapabilityScope.TrainingOnly ? 'training' : 'nutrition';
  }
  const roles = sortedRoles(conversation.participant?.roles);
  if (roles.length > 1) return 'both';
  return roles[0] === 'Trainer' ? 'training' : 'nutrition';
}

/** Binds an Invited or Requested row to its live status, scope, expiry and, while open, View invite. */
export function ChatEventCard({ conversation, message, settledAt, own }: ChatEventCardProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const invites = useInvites();

  const sourceId = message.eventSourceId;
  const status = message.eventStatus;
  if (!sourceId || !status) return null;

  const kind = message.eventType === ChatEventType.Requested ? 'request' : 'invite';
  const pending = status === CooperationCardStatus.Pending;
  const cooperation = conversation.cooperation;
  const scope = cooperation?.sourceId === sourceId ? cooperation.requestedScope : undefined;
  const scopeText = scope ? t(`chat.card.scope.${scope}`) : undefined;

  const openInvite = invites.data?.find((invite) => invite.id === sourceId);
  const expiryText = cardExpiry(t, openInvite?.expiresAt) ?? undefined;

  const canView = kind === 'invite' && pending && !own && openInvite !== undefined;

  return (
    <EventCard
      kind={kind}
      status={status}
      name={conversation.participant?.name ?? ''}
      domain={domainOf(conversation, sourceId)}
      own={own}
      scopeText={scopeText}
      expiryText={pending ? expiryText : undefined}
      dateText={settledAt ? shortDate(i18n.language, settledAt) : undefined}
      onViewInvite={
        canView ? () => router.push({ pathname: '/invite/[id]', params: { id: sourceId } }) : undefined
      }
    />
  );
}
