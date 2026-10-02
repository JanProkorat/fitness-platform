import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, ImageOff, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { cn } from '@/lib/utils';
import { showApiError, showError } from '@/lib/api-errors';
import { useImageVersion } from '@/hooks/useImageVersion';

import { ALLOWED_IMAGE_CONTENT_TYPES, FILE_PICKER_ACCEPT, MAX_IMAGE_SIZE_BYTES } from '@/components/library/pictureUpload';

export interface PictureUploadUrl {
  uploadUrl: string;
  blobUrl: string;
}

interface Props {
  /** Namespaced picture cache key (e.g. `food:<id>`) — see `useImageVersion`. */
  cacheKey: string;
  imageUrl?: string;
  /** True for an entry the caller does not own (or a trainer-only coach) —
   * shows the picture, if any, with no upload/replace/remove controls. */
  readOnly: boolean;
  /** Alt text for the displayed picture. */
  alt: string;
  /** Body text of the "remove picture" confirmation dialog. */
  removeConfirmDescription: string;
  /** Mints a pre-signed upload URL for the file. */
  requestUploadUrl: (file: { contentType: string; sizeBytes: number }) => Promise<PictureUploadUrl>;
  /** Confirms a completed upload by its blob URL. */
  confirmUpload: (blobUrl: string) => Promise<void>;
  /** Removes the picture. Must surface its own error feedback; a rejection
   * here just leaves the dialog open. */
  removePicture: () => Promise<void>;
  /** When set, clicking the picture calls this instead of opening the built-in
   * single-picture lightbox — lets the parent open a multi-picture viewer. */
  onViewPicture?: () => void;
}

/**
 * The shared full-width 16:9 picture drop zone of the Ingredients and Recipes
 * drawers. Never rendered in create mode (the parent mounts it only once an
 * id exists) and rendered with a `key` so a freshly-opened entry always gets
 * a clean mount.
 *
 * Upload/replace flow mirrors `Composer.tsx`'s chat-attachment pattern:
 * request a pre-signed URL, PUT the bytes directly to blob storage with a
 * bare `fetch` (never through the axios instance — a presigned URL doesn't
 * expect the API's Authorization header), then confirm the blob URL. Confirm
 * only runs after the PUT succeeds; a failure at any step shows a translated
 * error and leaves the previous picture unchanged.
 *
 * `imageUrl` seeds local state rather than being read directly: the parent
 * page holds the selected row in a plain snapshot taken when the row was
 * clicked, which does NOT re-sync when the list refetches after this
 * component's own mutations invalidate it.
 */
export default function PictureField({
  cacheKey,
  imageUrl,
  readOnly,
  alt,
  removeConfirmDescription,
  requestUploadUrl,
  confirmUpload,
  removePicture,
  onViewPicture,
}: Props) {
  const { t } = useTranslation();
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire on every child element the pointer crosses —
  // counting enter/leave pairs keeps the highlight from flickering.
  const dragDepthRef = useRef(0);

  const version = useImageVersion(cacheKey);

  const hasImage = Boolean(currentImageUrl);
  // The cache-buster is appended to the DISPLAYED src only — the blob URL
  // sent to confirm never carries it.
  const displaySrc = currentImageUrl
    ? `${currentImageUrl}${currentImageUrl.includes('?') ? '&' : '?'}v=${version}`
    : null;
  const isBusy = isUploading || isRemoving;

  async function processFile(file: File) {
    if (isBusy) {
      return;
    }
    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError(t('apiErrors.INVALID_IMAGE_CONTENT_TYPE'));
      showError('apiErrors.INVALID_IMAGE_CONTENT_TYPE');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(t('apiErrors.IMAGE_TOO_LARGE'));
      showError('apiErrors.IMAGE_TOO_LARGE');
      return;
    }

    setError(null);
    setLoadFailed(false);
    setIsUploading(true);
    try {
      const { uploadUrl, blobUrl } = await requestUploadUrl({ contentType: file.type, sizeBytes: file.size });
      if (!uploadUrl || !blobUrl) {
        throw new Error('Upload URL response missing uploadUrl/blobUrl');
      }

      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`Image upload PUT failed with status ${putResponse.status}`);
      }

      await confirmUpload(blobUrl);
      setCurrentImageUrl(blobUrl);
    } catch (uploadError) {
      showApiError(uploadError, 'library.picture.uploadError');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so re-selecting the same file after an error fires onChange again.
    event.target.value = '';
    if (!file) {
      return;
    }
    await processFile(file);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Always required for the element to become a valid drop target.
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (isBusy) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    void processFile(file);
  }

  async function handleRemoveConfirm() {
    setIsRemoving(true);
    try {
      await removePicture();
      setCurrentImageUrl(undefined);
      setRemoveConfirmOpen(false);
    } catch {
      // The removePicture callback already surfaced the error.
    } finally {
      setIsRemoving(false);
    }
  }

  const dropHandlers = readOnly
    ? {}
    : {
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
      };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('library.picture.sectionLabel')}
      </h3>

      {!readOnly && (
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          onChange={(event) => void handleFileSelected(event)}
        />
      )}

      {hasImage ? (
        <div
          className={cn(
            'relative aspect-video w-full overflow-hidden rounded-md bg-muted',
            !readOnly && isDragOver && 'ring-2 ring-primary',
          )}
          {...dropHandlers}
        >
          {displaySrc && !loadFailed ? (
            <>
              <button
                type="button"
                aria-label={t('library.picture.viewPicture')}
                className="block size-full cursor-zoom-in"
                onClick={() => (onViewPicture ? onViewPicture() : setLightboxOpen(true))}
              >
                <img
                  src={displaySrc}
                  alt={alt}
                  className="size-full object-cover"
                  onError={() => setLoadFailed(true)}
                />
              </button>
              {!onViewPicture && (
                <ImageLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} src={displaySrc} alt={alt} />
              )}
            </>
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-6 animate-spin text-foreground" aria-hidden="true" />
            </div>
          )}

          {!readOnly && !isUploading && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                disabled={isBusy}
                aria-label={t('library.picture.replace')}
                title={t('library.picture.replace')}
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                disabled={isBusy}
                aria-label={t('library.picture.remove')}
                title={t('library.picture.remove')}
                onClick={() => setRemoveConfirmOpen(true)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted">
          <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={t('library.picture.upload')}
          title={t('library.picture.upload')}
          aria-disabled={isBusy}
          className={cn(
            'flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted p-6 text-center transition-colors',
            !isBusy && 'cursor-pointer',
            isDragOver && 'border-primary bg-primary/5',
            isBusy && 'pointer-events-none opacity-50',
          )}
          onClick={() => {
            if (!isBusy) {
              fileInputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (!isBusy && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          {...dropHandlers}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <>
              <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-body text-muted-foreground">{t('library.picture.dropHint')}</p>
              <p className="text-meta text-muted-foreground">{t('library.picture.dropLimits')}</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-meta text-destructive">{error}</p>}

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('library.picture.removeConfirmTitle')}</DialogTitle>
            <DialogDescription>{removeConfirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={isRemoving} onClick={() => void handleRemoveConfirm()}>
              {t('library.picture.removeConfirmSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
