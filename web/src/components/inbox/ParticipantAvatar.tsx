import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Props {
  name?: string;
  initials?: string;
  avatarBlobUrl?: string;
  className?: string;
}

/**
 * Avatar for a conversation participant or a message sender — photo when
 * uploaded, initials fallback otherwise. Same visual treatment as
 * `components/clients/ClientAvatar`, sourced from `ParticipantDto.initials`
 * (server-computed) instead of first/last name, since a conversation's
 * `ParticipantDto` doesn't carry those split out.
 */
export default function ParticipantAvatar({ name, initials, avatarBlobUrl, className }: Props) {
  return (
    <Avatar className={cn(className)}>
      {avatarBlobUrl && <AvatarImage src={avatarBlobUrl} alt="" />}
      <AvatarFallback>{initials || name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
    </Avatar>
  );
}
