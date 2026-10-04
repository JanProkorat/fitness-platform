import { useTranslation } from 'react-i18next';
import { getEventPreviewText } from '@/lib/chatEvents';
import type { MessageDto } from '@/api/generated';

interface Props {
  message: MessageDto;
  isOwn: boolean;
  participantName: string;
}

/**
 * One cooperation-event row in the thread (#1100): a centered, muted, full-width
 * line — never a chat bubble — announcing an invite/request/accept/decline/withdrawal.
 * Rendered entirely client-side from `Kind`/`EventType` + `isOwn` + the participant's
 * name (docs/design/1095/, RULING (2)). The server's `Text` is a client-perspective
 * fallback for mobile only and is never read here.
 */
export default function EventBanner({ message, isOwn, participantName }: Props) {
  const { t } = useTranslation();
  const label = getEventPreviewText(t, message.eventType, isOwn, participantName);

  return (
    <div className="flex w-full justify-center py-1">
      <span className="max-w-105 rounded-full bg-muted px-3 py-1.5 text-center text-caption text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
