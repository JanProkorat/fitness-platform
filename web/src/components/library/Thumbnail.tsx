import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageVersion } from '@/hooks/useImageVersion';

interface Props {
  /** Namespaced picture cache key (e.g. `food:<id>`) — see `useImageVersion`. */
  cacheKey?: string;
  imageUrl?: string;
  /** The row's display name — used for the image's alt text. */
  name: string;
  className?: string;
  /**
   * Called with the cache-busted display src and alt text when the user
   * opens this thumbnail's picture in the lightbox. Only ever invoked when a
   * picture is actually loaded — a row with no picture (or a failed load)
   * stays a plain placeholder, and the row click it sits inside keeps opening
   * the drawer as before.
   */
  onViewPicture: (src: string, alt: string) => void;
}

/**
 * Small square thumbnail shown to the left of a row's name in the Ingredients
 * and Recipes tables. Falls back to a neutral placeholder when there is no
 * picture, or if the stored URL fails to load. When a picture IS loaded, the
 * thumbnail becomes its own button so activating it opens the lightbox
 * instead of the row's own click — `stopPropagation` keeps the two apart.
 */
export default function Thumbnail({ cacheKey, imageUrl, name, className, onViewPicture }: Props) {
  const { t } = useTranslation();
  const [loadFailed, setLoadFailed] = useState(false);
  const version = useImageVersion(cacheKey);
  // The cache-buster is appended to the DISPLAYED src only — the stored
  // imageUrl (and whatever is sent back on confirm) never carries it.
  const src = imageUrl ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${version}` : null;
  const alt = t('library.picture.thumbnailAlt', { name });

  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted',
        className,
      )}
    >
      {src && !loadFailed ? (
        <button
          type="button"
          aria-label={t('library.picture.viewPictureOf', { name })}
          className="block size-full cursor-zoom-in"
          onClick={(event) => {
            event.stopPropagation();
            onViewPicture(src, alt);
          }}
        >
          <img
            src={src}
            alt={alt}
            className="size-full object-cover"
            onError={() => setLoadFailed(true)}
          />
        </button>
      ) : (
        <ImageOff className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
