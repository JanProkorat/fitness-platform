import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  firstName?: string;
  lastName?: string;
  avatarBlobUrl?: string;
}

function initials(firstName?: string, lastName?: string): string {
  const combined = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return combined || '?';
}

/** Client-row avatar: photo when uploaded, initials fallback otherwise. */
export default function ClientAvatar({ firstName, lastName, avatarBlobUrl }: Props) {
  return (
    <Avatar>
      {avatarBlobUrl && <AvatarImage src={avatarBlobUrl} alt="" />}
      <AvatarFallback>{initials(firstName, lastName)}</AvatarFallback>
    </Avatar>
  );
}
