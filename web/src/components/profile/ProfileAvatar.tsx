import { useState } from 'react';

interface ProfileAvatarProps {
  url: string | null | undefined;
  initials: string;
  /** Size and text-size classes, e.g. "size-24 text-lede". */
  className: string;
}

/** Round photo with an ink initials fallback when there is no photo or it fails to load. */
export default function ProfileAvatar({ url, initials, className }: ProfileAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailedUrl(url)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground`}
    >
      {initials}
    </span>
  );
}
