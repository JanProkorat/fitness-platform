import { useTranslation } from 'react-i18next';
import { Image as ImageIcon } from 'lucide-react';
import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import { getEventPreviewText } from '@/lib/chatEvents';
import { cn } from '@/lib/utils';
import { CooperationCardStatus, CooperationType } from '@/api/generated';
import type { ConversationDto } from '@/api/generated';

/** Counts above this read "99+" so the badge never outgrows the row. */
const MAX_UNREAD_SHOWN = 99;

interface Props {
  conversation: ConversationDto;
  isSelected: boolean;
  onSelect: () => void;
}

/** `08:01` for today, "Yesterday" for yesterday, else a short locale date — matches the wireframe's row time column. */
function formatRowTime(iso: string | undefined, locale: string, yesterdayLabel: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return yesterdayLabel;
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/**
 * One conversation-list row: avatar, name, time, last-message preview, and
 * an unread dot when `unreadCount > 0`.
 */
export default function ConversationRow({ conversation, isSelected, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const participant = conversation.participant;
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const cooperation = conversation.cooperation;
  const pendingChip =
    cooperation?.status === CooperationCardStatus.Pending
      ? cooperation.type === CooperationType.Request
        ? 'request'
        : 'invite'
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-background',
        isSelected && 'bg-background',
      )}
    >
      <ParticipantAvatar
        name={participant?.name}
        initials={participant?.initials}
        avatarBlobUrl={participant?.avatarBlobUrl}
        className="size-10.5 shrink-0"
        textClassName="text-copy"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span data-testid="inbox-row-name" className={cn('truncate text-copy text-ink', hasUnread ? 'font-bold' : 'font-semibold')}>
              {participant?.name}
            </span>
            {pendingChip && (
              <span
                data-testid="inbox-row-chip"
                className={cn(
                  'shrink-0 rounded-full px-1.75 py-px text-label font-bold',
                  pendingChip === 'request' ? 'bg-marker/10 text-marker-text' : 'text-ink-2',
                )}
              >
                {t(pendingChip === 'request' ? 'inbox.row.chipRequest' : 'inbox.row.chipInvite')}
              </span>
            )}
          </span>
          <span className={cn('shrink-0 text-caption', hasUnread ? 'font-bold text-ink' : 'text-muted-foreground')}>
            {formatRowTime(conversation.lastMessageAt, i18n.language, t('inbox.row.yesterday'))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-meta', hasUnread ? 'text-ink-2' : 'text-muted-foreground')}>
            {conversation.lastMessageEventType != null
              ? getEventPreviewText(t, conversation.lastMessageEventType, conversation.lastMessageIsOwn ?? false, participant?.name ?? '')
              : conversation.lastMessage || (
                  conversation.lastMessageHasImage ? (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.25" aria-hidden="true" />
                      {t('inbox.list.photoMarker')}
                    </span>
                  ) : (
                    '—'
                  )
                )}
          </span>
          {hasUnread && (
            <span
              data-testid="inbox-row-unread-count"
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-marker-solid px-1.5 text-label font-bold text-sidebar-text"
              aria-label={t('inbox.row.unreadCount', { count: unreadCount })}
              role="status"
            >
              {unreadCount > MAX_UNREAD_SHOWN ? `${MAX_UNREAD_SHOWN}+` : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
