import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import RecipePictureField from '@/components/recipes/RecipePictureField';
import RecipeGalleryGrid from '@/components/recipes/RecipeGalleryGrid';
import { recipeImageCacheKey } from '@/hooks/useRecipesQueries';
import { useImageVersion } from '@/hooks/useImageVersion';

interface Props {
  recipeId: string;
  /** Main picture and extras are read from the loaded recipe, so a refetch after each picture action keeps this tab current. */
  imageUrl?: string;
  galleryImageUrls: string[];
  readOnly: boolean;
}

/** The drawer's Pictures tab: the main picture on top, the extra-pictures grid below, one shared viewer. */
export default function RecipePicturesTab({ recipeId, imageUrl, galleryImageUrls, readOnly }: Props) {
  const { t } = useTranslation();
  const version = useImageVersion(recipeImageCacheKey(recipeId));
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Main first, then the extras. The cache-buster only goes on the displayed main src.
  const mainSrc = imageUrl ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${version}` : null;
  const viewerImages = mainSrc ? [mainSrc, ...galleryImageUrls] : galleryImageUrls;
  const galleryOffset = mainSrc ? 1 : 0;
  // A refetch can shrink the list under an open viewer; treat an out-of-range index as closed.
  const openIndex = viewerIndex !== null && viewerIndex < viewerImages.length ? viewerIndex : null;
  const alt = t('recipes.picture.alt');

  return (
    <div className="flex flex-col gap-6">
      {/* Keyed by the main URL so a swap or removal remounts the field with fresh local state. */}
      <RecipePictureField
        key={`${recipeId}:${imageUrl ?? ''}`}
        recipeId={recipeId}
        imageUrl={imageUrl}
        readOnly={readOnly}
        onViewPicture={() => setViewerIndex(0)}
      />

      <RecipeGalleryGrid
        recipeId={recipeId}
        imageUrls={galleryImageUrls}
        readOnly={readOnly}
        onView={(galleryIndex) => setViewerIndex(galleryIndex + galleryOffset)}
      />

      {openIndex !== null && (
        <ImageLightbox
          open
          onOpenChange={(open) => !open && setViewerIndex(null)}
          src={viewerImages[openIndex] ?? ''}
          alt={alt}
          gallery={{ images: viewerImages, index: openIndex, onIndexChange: setViewerIndex }}
        />
      )}
    </div>
  );
}
