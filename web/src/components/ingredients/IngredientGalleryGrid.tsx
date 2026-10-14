import { useTranslation } from 'react-i18next';
import GalleryGrid from '@/components/library/GalleryGrid';
import { uploadPictureFile } from '@/components/library/pictureUpload';
import {
  useConfirmFoodGalleryImage,
  usePromoteFoodGalleryImage,
  useRemoveFoodGalleryImage,
  useRequestFoodGalleryUploadUrl,
} from '@/hooks/useIngredientsQueries';

interface Props {
  foodId: string;
  /** The stored extra-picture URLs, in order. Always the server's current list. */
  imageUrls: string[];
  readOnly: boolean;
  /** Opens the viewer on the extra picture at this index of `imageUrls`. */
  onView: (galleryIndex: number) => void;
}

/** The ingredient's extra-pictures grid — binds the shared `GalleryGrid` to the food gallery mutations. */
export default function IngredientGalleryGrid({ foodId, imageUrls, readOnly, onView }: Props) {
  const { t } = useTranslation();
  const requestUploadUrl = useRequestFoodGalleryUploadUrl();
  const confirmUpload = useConfirmFoodGalleryImage();
  const removeMutation = useRemoveFoodGalleryImage();
  const promoteMutation = usePromoteFoodGalleryImage();

  return (
    <GalleryGrid
      imageUrls={imageUrls}
      readOnly={readOnly}
      onView={onView}
      testIdPrefix="ingredient-gallery"
      removeConfirmDescription={t('ingredients.pictures.removeConfirmDescription')}
      uploadFile={(file) =>
        uploadPictureFile(
          file,
          (request) => requestUploadUrl.mutateAsync({ foodId, request }),
          async (blobUrl) => {
            await confirmUpload.mutateAsync({ foodId, blobUrl });
          },
        )
      }
      removeImage={(imageUrl) => removeMutation.mutateAsync({ foodId, imageUrl })}
      promoteImage={(imageUrl) => promoteMutation.mutateAsync({ foodId, imageUrl })}
    />
  );
}
