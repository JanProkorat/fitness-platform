import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
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
 * `extractYouTubeVideoId`, never trusted from anywhere upstream. A message
 * carrying `imageUrl` (#1096) renders the image inline instead, with any
 * accompanying text as a caption below it; a YouTube link never coexists
 * with an image attachment, so the image branch takes precedence.
 */
export default function MessageBubble({ message, isOwn, otherParticipant, ownInitials, ownAvatarBlobUrl }: Props) {
  const { t } = useTranslation();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const text = message.text ?? '';
  const firstUrl = message.imageUrl ? null : findFirstUrl(text);
  const videoId = firstUrl ? extractYouTubeVideoId(firstUrl) : null;
  const caption = videoId && firstUrl ? stripUrlFromCaption(text, firstUrl) : '';
  const aspectRatioStyle =
    message.imageWidth && message.imageHeight
      ? { aspectRatio: `${message.imageWidth} / ${message.imageHeight}` }
      : undefined;

  return (
    <div className={cn('flex items-end gap-2', isOwn ? 'flex-row-reverse self-end' : 'flex-row self-start')}>
      <ParticipantAvatar
        name={isOwn ? undefined : otherParticipant?.name}
        initials={isOwn ? ownInitials : otherParticipant?.initials}
        avatarBlobUrl={isOwn ? ownAvatarBlobUrl : otherParticipant?.avatarBlobUrl}
        className="size-7 shrink-0"
      />
      {message.imageUrl ? (
        <div
          className={cn('max-w-80 overflow-hidden rounded-2xl', isOwn ? 'bg-sidebar-bg text-paper' : 'bg-bubble text-foreground')}
        >
          {imageLoadFailed ? (
            <div
              style={aspectRatioStyle}
              className="flex flex-col items-center justify-center gap-1.5 p-6 text-caption text-muted-foreground"
            >
              <ImageOff className="size-6" aria-hidden="true" />
              <span>{t('inbox.thread.imageUnavailable')}</span>
            </div>
          ) : (
            <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={message.imageUrl}
                alt={t('inbox.thread.imageAlt')}
                style={aspectRatioStyle}
                className="block w-full object-cover"
                onError={() => setImageLoadFailed(true)}
              />
            </a>
          )}
          {text && <div className="whitespace-pre-wrap px-3.5 py-2.5 text-body break-words">{text}</div>}
        </div>
      ) : videoId ? (
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
