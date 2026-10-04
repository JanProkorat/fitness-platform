import type { TFunction } from 'i18next';
import { ChatEventType } from '@/api/generated';

/**
 * Localized copy for one cooperation event (#1100), from `eventType` + `isOwn`
 * (the caller is always the coach on web — docs/design/1095/, RULING (2)) + the
 * participant's name. Shared by `EventBanner` (the thread row) and
 * `ConversationRow` (the list preview) so the two never drift. `Withdrawn` is
 * deliberately neutral about who withdrew and never says why (RULING R3).
 */
export function getEventPreviewText(
  t: TFunction,
  eventType: ChatEventType | undefined,
  isOwn: boolean,
  participantName: string,
): string {
  switch (eventType) {
    case ChatEventType.Invited:
      return t('inbox.events.invited', { name: participantName });
    case ChatEventType.Requested:
      return t('inbox.events.requested', { name: participantName });
    case ChatEventType.Accepted:
      return isOwn
        ? t('inbox.events.accepted.own', { name: participantName })
        : t('inbox.events.accepted.other', { name: participantName });
    case ChatEventType.Declined:
      return isOwn
        ? t('inbox.events.declined.own', { name: participantName })
        : t('inbox.events.declined.other', { name: participantName });
    case ChatEventType.Withdrawn:
      return t('inbox.events.withdrawn');
    default:
      return '';
  }
}
