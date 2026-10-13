import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
  /** Overrides the avatar root (size) and fallback (colours, type) classes; omitted keeps the list-row look. */
  className?: string;
  fallbackClassName?: string;
}

function initials(firstName?: string, lastName?: string): string {
  const combined = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return combined || '?';
}

/** Client-row avatar: photo when uploaded, initials fallback otherwise. */
export default function ClientAvatar({ firstName, lastName, avatarBlobUrl, className, fallbackClassName }: Props) {
  return (
    <Avatar className={className}>
      {avatarBlobUrl && <AvatarImage src={avatarBlobUrl} alt="" />}
      <AvatarFallback className={fallbackClassName}>{initials(firstName, lastName)}</AvatarFallback>
    </Avatar>
  );
}
