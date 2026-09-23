import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import YouTubePreviewCard from '@/components/inbox/YouTubePreviewCard';
import { cn } from '@/lib/utils';
import { extractYouTubeVideoId, findFirstUrl, stripUrlFromCaption } from '@/lib/youtube';
import type { MessageDto, ParticipantDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  isOwn: boolean;
  otherParticipant?: ParticipantDto;
  ownInitials: string;
  ownAvatarBlobUrl?: string;
}

/**
 * One message bubble. Own messages render right-aligned with the sidebar's
 * dark surface + white text and the coach's own avatar; the other party's
 * render left-aligned with the `bg-bubble` fill and the participant's avatar
 * (docs/design/1095/inbox-inventory.md). A message whose text contains a
 * validated YouTube link renders as an embedded preview card instead of a
 * plain text bubble — the URL is re-validated here via
 * `extractYouTubeVideoId`, never trusted from anywhere upstream.
 */
export default function MessageBubble({ message, isOwn, otherParticipant, ownInitials, ownAvatarBlobUrl }: Props) {
  const text = message.text ?? '';
  const firstUrl = findFirstUrl(text);
  const videoId = firstUrl ? extractYouTubeVideoId(firstUrl) : null;
  const caption = videoId && firstUrl ? stripUrlFromCaption(text, firstUrl) : '';

  return (
    <div className={cn('flex items-end gap-2', isOwn ? 'flex-row-reverse self-end' : 'flex-row self-start')}>
      <ParticipantAvatar
        name={isOwn ? undefined : otherParticipant?.name}
        initials={isOwn ? ownInitials : otherParticipant?.initials}
        avatarBlobUrl={isOwn ? ownAvatarBlobUrl : otherParticipant?.avatarBlobUrl}
        className="size-7 shrink-0"
      />
      {videoId ? (
        <YouTubePreviewCard videoId={videoId} caption={caption} alignEnd={isOwn} />
      ) : (
        <div
          className={cn(
            'max-w-105 whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-body break-words',
            isOwn ? 'bg-sidebar-bg text-paper' : 'bg-bubble text-foreground',
          )}
        >
          {text}
        </div>
      )}
    </div>
  );
}
