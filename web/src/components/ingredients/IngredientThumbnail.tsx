import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFoodImageVersion } from '@/hooks/useIngredientsQueries';

interface Props {
  foodId?: string;
  imageUrl?: string;
  /** The food's display name — used for the image's alt text. */
  name: string;
  className?: string;
  /**
   * Called with the cache-busted display src and alt text when the user
   * opens this thumbnail's picture in the lightbox (#1140). Only ever
   * invoked when a picture is actually loaded — a food with no picture (or
   * a failed load) stays a plain placeholder, and the row click it sits
   * inside keeps opening the drawer as before.
   */
  onViewPicture: (src: string, alt: string) => void;
}

/**
 * Small square thumbnail shown to the left of a food's name in the
 * Ingredients table (#1140). Falls back to a neutral placeholder when the
 * food has no picture, or if the stored URL fails to load. When a picture
 * IS loaded, the thumbnail becomes its own button so clicking/activating it
 * opens the picture in a lightbox instead of the row's own click (which
 * opens the edit drawer) — `stopPropagation` keeps the two from firing
 * together.
 */
export default function IngredientThumbnail({ foodId, imageUrl, name, className, onViewPicture }: Props) {
  const { t } = useTranslation();
  const [loadFailed, setLoadFailed] = useState(false);
  const version = useFoodImageVersion(foodId);
  // Appends the cache-buster to the DISPLAYED src only — the stored imageUrl
  // (and whatever is ever sent back to confirmFoodImage) never carries it.
  // The main picture's blob key is deterministic (foods/{id}.jpg), so a
  // replace keeps the same url and the browser would otherwise keep showing
  // the previous cached bytes.
  const src = imageUrl ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${version}` : null;
  const alt = t('ingredients.picture.thumbnailAlt', { name });

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
          aria-label={t('ingredients.picture.viewPictureOf', { name })}
          className="block size-full cursor-zoom-in"
          onClick={(event) => {
            // Stops the row's own onClick (which opens the edit drawer) from
            // also firing — this click is for the picture, not the row.
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
