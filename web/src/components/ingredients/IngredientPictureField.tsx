import { useTranslation } from 'react-i18next';
import PictureField from '@/components/library/PictureField';
import {
  foodImageCacheKey,
  useConfirmFoodImage,
  useRemoveFoodImage,
  useRequestFoodImageUploadUrl,
} from '@/hooks/useIngredientsQueries';

interface Props {
  foodId: string;
  imageUrl?: string;
  /** True for a food the caller does not own (or a trainer-only coach). */
  readOnly: boolean;
  /** Opens the tab's multi-picture viewer instead of the single-picture lightbox. */
  onViewPicture?: () => void;
}

/**
 * The ingredient drawer's main-picture area — a thin wrapper binding the shared
 * `PictureField` to the food image mutations. The parent renders it with a
 * `key` so a swapped or removed picture gets a clean mount.
 */
export default function IngredientPictureField({ foodId, imageUrl, readOnly, onViewPicture }: Props) {
  const { t } = useTranslation();
  const requestUploadUrlMutation = useRequestFoodImageUploadUrl();
  const confirmMutation = useConfirmFoodImage();
  const removeMutation = useRemoveFoodImage();

  return (
    <PictureField
      cacheKey={foodImageCacheKey(foodId)}
      imageUrl={imageUrl}
      readOnly={readOnly}
      alt={t('ingredients.picture.alt')}
      removeConfirmDescription={t('ingredients.picture.removeConfirmDescription')}
      requestUploadUrl={(file) => requestUploadUrlMutation.mutateAsync({ foodId, request: file })}
      confirmUpload={async (blobUrl) => {
        await confirmMutation.mutateAsync({ foodId, blobUrl });
      }}
      removePicture={() => removeMutation.mutateAsync(foodId)}
      onViewPicture={onViewPicture}
    />
  );
}
