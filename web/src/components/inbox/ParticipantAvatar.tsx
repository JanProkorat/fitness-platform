import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Props {
  name?: string;
  initials?: string;
  avatarBlobUrl?: string;
  className?: string;
  /** Initials size token; the board uses 14px in list rows and 11px on the smaller avatars. */
  textClassName?: string;
  /** `own` is the signed-in professional's dark disc; `neutral` is the other party's ground-coloured one. */
  tone?: 'neutral' | 'own';
}

/**
 * Avatar for a conversation participant or a message sender — photo when
 * uploaded, initials fallback otherwise. Same visual treatment as
 * `components/clients/ClientAvatar`, sourced from `ParticipantDto.initials`
 * (server-computed) instead of first/last name, since a conversation's
 * `ParticipantDto` doesn't carry those split out.
 */
export default function ParticipantAvatar({
  name,
  initials,
  avatarBlobUrl,
  className,
  textClassName = 'text-label',
  tone = 'neutral',
}: Props) {
  return (
    <Avatar className={cn(className)}>
      {avatarBlobUrl && <AvatarImage src={avatarBlobUrl} alt="" />}
      <AvatarFallback
        className={cn(
          'font-semibold',
          textClassName,
          tone === 'own' ? 'bg-sidebar text-sidebar-text' : 'bg-background text-ink-2',
        )}
      >
        {initials || name?.[0]?.toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
