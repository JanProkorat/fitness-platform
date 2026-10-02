import { useTranslation } from 'react-i18next';
import PictureField from '@/components/library/PictureField';
import {
  recipeImageCacheKey,
  useConfirmRecipeImage,
  useRemoveRecipeImage,
  useRequestRecipeImageUploadUrl,
} from '@/hooks/useRecipesQueries';

interface Props {
  recipeId: string;
  imageUrl?: string;
  readOnly: boolean;
  onViewPicture?: () => void;
}

/** The recipe's main-picture area — binds the shared `PictureField` to the recipe image mutations. */
export default function RecipePictureField({ recipeId, imageUrl, readOnly, onViewPicture }: Props) {
  const { t } = useTranslation();
  const requestUploadUrlMutation = useRequestRecipeImageUploadUrl();
  const confirmMutation = useConfirmRecipeImage();
  const removeMutation = useRemoveRecipeImage();

  return (
    <PictureField
      cacheKey={recipeImageCacheKey(recipeId)}
      imageUrl={imageUrl}
      readOnly={readOnly}
      alt={t('recipes.picture.alt')}
      removeConfirmDescription={t('recipes.picture.removeConfirmDescription')}
      requestUploadUrl={(file) => requestUploadUrlMutation.mutateAsync({ recipeId, request: file })}
      confirmUpload={async (blobUrl) => {
        await confirmMutation.mutateAsync({ recipeId, blobUrl });
      }}
      removePicture={() => removeMutation.mutateAsync(recipeId)}
      onViewPicture={onViewPicture}
    />
  );
}
