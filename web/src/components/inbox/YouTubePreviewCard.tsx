import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { youtubeThumbnailUrl, youtubeWatchUrl } from '@/lib/youtube';

interface Props {
  videoId: string;
  /**
   * The caller-typed message text with the matched YouTube URL already
   * stripped out (see `stripUrlFromCaption`) — empty when the message was
   * nothing but the link. Never invent a duration.
   */
  caption: string;
  alignEnd?: boolean;
}

/**
 * Embedded YouTube preview card for a message whose text contains a
 * YouTube link (#1095 — video is never stored, only ever shared as a
 * link). Opens the video in a new tab; `videoId` is already validated by
 * `extractYouTubeVideoId` before this renders, so the thumbnail/watch URLs
 * are always built from a known-good 11-character id.
 */
export default function YouTubePreviewCard({ videoId, caption, alignEnd }: Props) {
  const { t } = useTranslation();

  return (
    <a
      href={youtubeWatchUrl(videoId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('flex max-w-[280px] flex-col gap-1', alignEnd && 'self-end')}
    >
      <img
        src={youtubeThumbnailUrl(videoId)}
        alt=""
        className="aspect-video w-full rounded-xl border border-border object-cover"
      />
      <span className="truncate text-caption text-muted-foreground">
        {caption ? `${caption} • ` : ''}
        {t('inbox.video.label')}
      </span>
    </a>
  );
}
