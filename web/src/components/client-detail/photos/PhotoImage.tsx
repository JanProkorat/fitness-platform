import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Pre-signed URL from the live photos query; never stored in state. */
  src: string | undefined;
  alt: string;
  /** Asked once for fresh URLs when the first load of an image fails. */
  onExpired: () => void;
  className?: string;
  fit?: 'cover' | 'contain';
}

/**
 * A photo that survives an expired pre-signed URL: the first failure asks the
 * photos query for fresh URLs, a failure of the refreshed URL shows the placeholder.
 */
export default function PhotoImage({ src, alt, onExpired, className, fit = 'cover' }: Props) {
  const { t } = useTranslation();
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);

  if (!src || failedSrcs.includes(src)) {
    return (
      <div
        role="img"
        aria-label={t('clientDetail.photos.imageUnavailable')}
        className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (failedSrcs.length === 0) {
          onExpired();
        }
        setFailedSrcs((current) => [...current, src]);
      }}
      className={cn('bg-muted', fit === 'cover' ? 'object-cover' : 'object-contain', className)}
    />
  );
}
