import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Images, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { showApiError, showError } from '@/lib/api-errors';
import { FILE_PICKER_ACCEPT, imageFileErrorKey, putFileToBlobStorage } from '@/components/library/pictureUpload';
import {
  useConfirmRecipeGalleryImage,
  usePromoteRecipeGalleryImage,
  useRemoveRecipeGalleryImage,
  useRequestRecipeGalleryUploadUrl,
} from '@/hooks/useRecipesQueries';

/** Mirrors the server's gallery cap (`RECIPE_GALLERY_FULL`). */
export const MAX_GALLERY_IMAGES = 6;

interface Props {
  recipeId: string;
  /** The stored extra-picture URLs, in order. Always the server's current list. */
  imageUrls: string[];
  readOnly: boolean;
  /** Opens the viewer on the extra picture at this index of `imageUrls`. */
  onView: (galleryIndex: number) => void;
}

/** The extra-pictures grid of the Pictures tab: view, remove, set as main, and an add tile. */
export default function RecipeGalleryGrid({ recipeId, imageUrls, readOnly, onView }: Props) {
  const { t } = useTranslation();
  const requestUploadUrl = useRequestRecipeGalleryUploadUrl();
  const confirmUpload = useConfirmRecipeGalleryImage();
  const removeMutation = useRemoveRecipeGalleryImage();
  const promoteMutation = usePromoteRecipeGalleryImage();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire on every child the pointer crosses — count pairs to avoid flicker.
  const dragDepthRef = useRef(0);

  const isBusy = isUploading || removeMutation.isPending || promoteMutation.isPending;
  const remainingSlots = MAX_GALLERY_IMAGES - imageUrls.length;
  const canAdd = !readOnly && remainingSlots > 0;

  async function uploadOne(file: File) {
    const errorKey = imageFileErrorKey(file);
    if (errorKey) {
      showError(errorKey);
      return;
    }
    const { uploadUrl, blobUrl } = await requestUploadUrl.mutateAsync({
      recipeId,
      request: { contentType: file.type, sizeBytes: file.size },
    });
    if (!uploadUrl || !blobUrl) {
      throw new Error('Upload URL response missing uploadUrl/blobUrl');
    }
    await putFileToBlobStorage(uploadUrl, file);
    await confirmUpload.mutateAsync({ recipeId, blobUrl });
  }

  async function uploadFiles(files: File[]) {
    if (isBusy || files.length === 0) {
      return;
    }
    setIsUploading(true);
    try {
      for (const file of files.slice(0, remainingSlots)) {
        await uploadOne(file);
      }
    } catch (uploadError) {
      showApiError(uploadError, 'library.picture.uploadError');
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset so re-selecting the same file after an error fires onChange again.
    event.target.value = '';
    void uploadFiles(files);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function confirmRemove() {
    if (!removeTarget) {
      return;
    }
    try {
      await removeMutation.mutateAsync({ recipeId, imageUrl: removeTarget });
      setRemoveTarget(null);
    } catch {
      // The hook already surfaced the error; keep the dialog open for a retry.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
        <Images className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('recipes.pictures.galleryLabel')}
        <span className="text-meta font-normal text-muted-foreground">
          {t('recipes.pictures.galleryCount', { count: imageUrls.length, max: MAX_GALLERY_IMAGES })}
        </span>
      </h3>

      {canAdd && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          data-testid="recipe-gallery-input"
          onChange={handleFileSelected}
        />
      )}

      {imageUrls.length === 0 && !canAdd && (
        <p className="text-body text-muted-foreground">{t('recipes.pictures.galleryEmpty')}</p>
      )}

      <ul className="grid grid-cols-3 gap-3">
        {imageUrls.map((url, index) => {
          const number = index + 1;
          return (
            <li
              key={url}
              data-testid="recipe-gallery-tile"
              className="relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              <button
                type="button"
                aria-label={t('library.picture.viewPicture')}
                className="block size-full cursor-zoom-in"
                onClick={() => onView(index)}
              >
                <img
                  src={url}
                  alt={t('recipes.pictures.galleryAlt', { number })}
                  className="size-full object-cover"
                />
              </button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1.5 right-1.5"
                    disabled={isBusy}
                    aria-label={t('recipes.pictures.remove', { number })}
                    title={t('recipes.pictures.remove', { number })}
                    onClick={() => setRemoveTarget(url)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute right-1.5 bottom-1.5 left-1.5"
                    disabled={isBusy}
                    aria-label={t('recipes.pictures.setAsMainLabel', { number })}
                    onClick={() => promoteMutation.mutate({ recipeId, imageUrl: url })}
                  >
                    <Star aria-hidden="true" />
                    {t('recipes.pictures.setAsMain')}
                  </Button>
                </>
              )}
            </li>
          );
        })}

        {canAdd && (
          <li className="aspect-square">
            <button
              type="button"
              aria-label={t('recipes.pictures.addPicture')}
              title={t('recipes.pictures.addPicture')}
              disabled={isBusy}
              className={cn(
                'flex size-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted p-2 text-center text-meta text-muted-foreground transition-colors',
                !isBusy && 'cursor-pointer hover:border-primary',
                isDragOver && 'border-primary bg-primary/5',
                isBusy && 'opacity-50',
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <ImagePlus className="size-6" aria-hidden="true" />
                  <span>{t('recipes.pictures.addPicture')}</span>
                </>
              )}
            </button>
          </li>
        )}
      </ul>

      {canAdd && <p className="text-meta text-muted-foreground">{t('library.picture.dropLimits')}</p>}

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('library.picture.removeConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('recipes.pictures.removeConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => void confirmRemove()}
            >
              {t('library.picture.removeConfirmSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
