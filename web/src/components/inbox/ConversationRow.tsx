import { useTranslation } from 'react-i18next';
import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import { cn } from '@/lib/utils';
import type { ConversationDto } from '@/api/generated';

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
 * an unread dot when `unreadCount > 0`. A null `id` (a linked client with
 * no conversation yet, matched by the roster-filter path) is still
 * selectable — opening it starts the conversation.
 */
export default function ConversationRow({ conversation, isSelected, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const participant = conversation.participant;
  const hasUnread = (conversation.unreadCount ?? 0) > 0;
  // A placeholder row carries no conversation, so its lastMessageAt is the
  // default date — show nothing rather than 1 Jan, and invite the coach to write.
  const hasConversation = conversation.id != null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted',
        isSelected && 'bg-muted',
      )}
    >
      <ParticipantAvatar
        name={participant?.name}
        initials={participant?.initials}
        avatarBlobUrl={participant?.avatarBlobUrl}
        className="size-11 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-body font-bold text-ink">{participant?.name}</span>
          <span className="shrink-0 text-caption text-muted-foreground">
            {hasConversation ? formatRowTime(conversation.lastMessageAt, i18n.language, t('inbox.row.yesterday')) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-caption text-muted-foreground">
            {hasConversation
              ? conversation.lastMessage || (conversation.lastMessageHasImage ? t('inbox.list.photoMarker') : '—')
              : t('inbox.row.noConversationYet')}
          </span>
          {hasUnread && (
            <span
              className="size-2 shrink-0 rounded-full bg-primary"
              aria-label={t('inbox.row.unreadAriaLabel')}
              role="status"
            />
          )}
        </div>
      </div>
    </button>
  );
}
