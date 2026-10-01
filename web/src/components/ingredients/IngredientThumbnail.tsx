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
}

/**
 * Small square thumbnail shown to the left of a food's name in the
 * Ingredients table (#1140). Falls back to a neutral placeholder when the
 * food has no picture, or if the stored URL fails to load.
 */
export default function IngredientThumbnail({ foodId, imageUrl, name, className }: Props) {
  const { t } = useTranslation();
  const [loadFailed, setLoadFailed] = useState(false);
  const version = useFoodImageVersion(foodId);
  // Appends the cache-buster to the DISPLAYED src only — the stored imageUrl
  // (and whatever is ever sent back to confirmFoodImage) never carries it.
  // The main picture's blob key is deterministic (foods/{id}.jpg), so a
  // replace keeps the same url and the browser would otherwise keep showing
  // the previous cached bytes.
  const src = imageUrl ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${version}` : null;

  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted',
        className,
      )}
    >
      {src && !loadFailed ? (
        <img
          src={src}
          alt={t('ingredients.picture.thumbnailAlt', { name })}
          className="size-full object-cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
