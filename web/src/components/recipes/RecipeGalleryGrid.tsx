import { useTranslation } from 'react-i18next';
import GalleryGrid from '@/components/library/GalleryGrid';
import { uploadPictureFile } from '@/components/library/pictureUpload';
import {
  useConfirmRecipeGalleryImage,
  usePromoteRecipeGalleryImage,
  useRemoveRecipeGalleryImage,
  useRequestRecipeGalleryUploadUrl,
} from '@/hooks/useRecipesQueries';

interface Props {
  recipeId: string;
  /** The stored extra-picture URLs, in order. Always the server's current list. */
  imageUrls: string[];
  readOnly: boolean;
  /** Opens the viewer on the extra picture at this index of `imageUrls`. */
  onView: (galleryIndex: number) => void;
}

/** The recipe's extra-pictures grid — binds the shared `GalleryGrid` to the recipe gallery mutations. */
export default function RecipeGalleryGrid({ recipeId, imageUrls, readOnly, onView }: Props) {
  const { t } = useTranslation();
  const requestUploadUrl = useRequestRecipeGalleryUploadUrl();
  const confirmUpload = useConfirmRecipeGalleryImage();
  const removeMutation = useRemoveRecipeGalleryImage();
  const promoteMutation = usePromoteRecipeGalleryImage();

  return (
    <GalleryGrid
      imageUrls={imageUrls}
      readOnly={readOnly}
      onView={onView}
      testIdPrefix="recipe-gallery"
      removeConfirmDescription={t('recipes.pictures.removeConfirmDescription')}
      uploadFile={(file) =>
        uploadPictureFile(
          file,
          (request) => requestUploadUrl.mutateAsync({ recipeId, request }),
          async (blobUrl) => {
            await confirmUpload.mutateAsync({ recipeId, blobUrl });
          },
        )
      }
      removeImage={(imageUrl) => removeMutation.mutateAsync({ recipeId, imageUrl })}
      promoteImage={(imageUrl) => promoteMutation.mutateAsync({ recipeId, imageUrl })}
    />
  );
}
