import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Images, Loader2, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { showApiError, showError } from '@/lib/api-errors';
import {
  FILE_PICKER_ACCEPT,
  MAX_GALLERY_IMAGES,
  imageFileErrorKey,
} from '@/components/library/pictureUpload';

interface Props {
  /** The extra-picture URLs in order — stored URLs, or browser previews while staging. */
  imageUrls: string[];
  readOnly: boolean;
  /** Disables every control, e.g. while the parent is uploading. */
  disabled?: boolean;
  /** Opens the viewer on the extra picture at this index of `imageUrls`. */
  onView: (galleryIndex: number) => void;
  /** Adds one validated file. A rejection is toasted here and stops the batch. */
  uploadFile: (file: File) => Promise<void>;
  /** Removes the picture. Must surface its own error feedback; a rejection keeps the dialog open. */
  removeImage: (imageUrl: string) => Promise<void>;
  /** Makes the picture the main one. Must surface its own error feedback. */
  promoteImage: (imageUrl: string) => Promise<void>;
  /** Body of the remove confirmation. Leave unset to remove without asking (staged pictures). */
  removeConfirmDescription?: string;
  /** Prefix of the file input and tile test ids, e.g. `recipe-gallery`. */
  testIdPrefix: string;
}

/**
 * The extra-pictures grid of a Pictures tab: view, remove, set as main, and an
 * add tile with multi-file pick and drop. Entity-neutral — the parent binds the
 * callbacks, so this never imports an entity hook.
 */
export default function GalleryGrid({
  imageUrls,
  readOnly,
  disabled = false,
  onView,
  uploadFile,
  removeImage,
  promoteImage,
  removeConfirmDescription,
  testIdPrefix,
}: Props) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire on every child the pointer crosses — count pairs to avoid flicker.
  const dragDepthRef = useRef(0);

  const isBusy = disabled || isUploading || isChanging;
  const remainingSlots = MAX_GALLERY_IMAGES - imageUrls.length;
  const canAdd = !readOnly && remainingSlots > 0;

  async function uploadFiles(files: File[]) {
    if (isBusy || files.length === 0) {
      return;
    }
    setIsUploading(true);
    try {
      for (const file of files.slice(0, remainingSlots)) {
        const errorKey = imageFileErrorKey(file);
        if (errorKey) {
          showError(errorKey);
          continue;
        }
        await uploadFile(file);
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

  async function runChange(change: () => Promise<void>): Promise<boolean> {
    setIsChanging(true);
    try {
      await change();
      return true;
    } catch {
      // The callback already surfaced the error.
      return false;
    } finally {
      setIsChanging(false);
    }
  }

  async function confirmRemove(url: string) {
    if (await runChange(() => removeImage(url))) {
      setRemoveTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
        <Images className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('library.gallery.label')}
        <span className="text-meta font-normal text-muted-foreground">
          {t('library.gallery.count', { count: imageUrls.length, max: MAX_GALLERY_IMAGES })}
        </span>
      </h3>

      {canAdd && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          data-testid={`${testIdPrefix}-input`}
          onChange={handleFileSelected}
        />
      )}

      {imageUrls.length === 0 && !canAdd && (
        <p className="text-body text-muted-foreground">{t('library.gallery.empty')}</p>
      )}

      <ul className="grid grid-cols-3 gap-3">
        {imageUrls.map((url, index) => {
          const number = index + 1;
          return (
            <li
              key={url}
              data-testid={`${testIdPrefix}-tile`}
              className="relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              <button
                type="button"
                aria-label={t('library.picture.viewPicture')}
                className="block size-full cursor-zoom-in"
                onClick={() => onView(index)}
              >
                <img src={url} alt={t('library.gallery.alt', { number })} className="size-full object-cover" />
              </button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1.5 right-1.5"
                    disabled={isBusy}
                    aria-label={t('library.gallery.remove', { number })}
                    title={t('library.gallery.remove', { number })}
                    onClick={() => {
                      if (removeConfirmDescription === undefined) {
                        void runChange(() => removeImage(url));
                      } else {
                        setRemoveTarget(url);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute right-1.5 bottom-1.5 left-1.5"
                    disabled={isBusy}
                    aria-label={t('library.gallery.setAsMainLabel', { number })}
                    onClick={() => void runChange(() => promoteImage(url))}
                  >
                    <Star aria-hidden="true" />
                    {t('library.gallery.setAsMain')}
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
              aria-label={t('library.gallery.addPicture')}
              title={t('library.gallery.addPicture')}
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
                  <span>{t('library.gallery.addPicture')}</span>
                </>
              )}
            </button>
          </li>
        )}
      </ul>

      {canAdd && <p className="text-meta text-muted-foreground">{t('library.picture.dropLimits')}</p>}

      {removeConfirmDescription !== undefined && (
        <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('library.picture.removeConfirmTitle')}</DialogTitle>
              <DialogDescription>{removeConfirmDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isChanging}
                onClick={() => removeTarget && void confirmRemove(removeTarget)}
              >
                {t('library.picture.removeConfirmSubmit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
