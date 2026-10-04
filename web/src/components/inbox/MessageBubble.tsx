import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import ParticipantAvatar from '@/components/inbox/ParticipantAvatar';
import YouTubePreviewCard from '@/components/inbox/YouTubePreviewCard';
import { cn } from '@/lib/utils';
import { extractYouTubeVideoId, findFirstUrl, stripUrlFromCaption } from '@/lib/youtube';
import type { MessageDto, ParticipantDto } from '@/api/generated';

/** Matches the `max-w-80` (20rem) Tailwind token on the image bubble wrapper below — the
 * reserved box (see `imageBoxStyle`) must never exceed what that token already caps the
 * bubble to, so the two stay tied together rather than drifting apart. */
const IMAGE_BUBBLE_MAX_WIDTH_PX = 320;

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
  // A definite pixel width (never upscaled past the stored size) alongside aspect-ratio
  // reserves the image's box before the file has loaded. `aspect-ratio` alone is not enough:
  // it computes height from the box's own width, and before load the `<img>` has no intrinsic
  // size and its containing block (the max-w-80 wrapper below) has no definite width either —
  // both resolve to 0, so the thread scrolls to a `scrollHeight` that grows again once the
  // image loads (#1096 QA finding: newest image cut off by ~40px). Falls back to the previous,
  // unreserved behaviour when dimensions are missing.
  const imageBoxStyle =
    message.imageWidth && message.imageHeight
      ? {
          width: Math.min(message.imageWidth, IMAGE_BUBBLE_MAX_WIDTH_PX),
          aspectRatio: `${message.imageWidth} / ${message.imageHeight}`,
        }
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
              style={imageBoxStyle}
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
                style={imageBoxStyle}
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
