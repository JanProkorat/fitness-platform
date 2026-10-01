import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, ImageOff, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { cn } from '@/lib/utils';
import { showApiError, showError } from '@/lib/api-errors';
import {
  useConfirmFoodImage,
  useFoodImageVersion,
  useRemoveFoodImage,
  useRequestFoodImageUploadUrl,
} from '@/hooks/useIngredientsQueries';

/** jpeg/png/webp only — mirrors the chat-attachment composer's own
 * client-side allowlist (`Composer.tsx`). The server additionally accepts
 * heic/heif, but browsers can't render those, so the web picker never offers
 * them; the server stays the real authority either way. */
const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const FILE_PICKER_ACCEPT = ALLOWED_IMAGE_CONTENT_TYPES.join(',');
/** Mirrors the server's `ImageUploadService.MaxImageSizeBytes` (5 MiB). */
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

interface Props {
  foodId: string;
  imageUrl?: string;
  /** True for a food the caller does not own (or a trainer-only coach) —
   * shows the picture, if any, with no upload/replace/remove controls. */
  readOnly: boolean;
}

/**
 * The ingredient drawer's picture area (#1140) — a full-width 16:9 drop zone
 * that uploads, replaces, and removes a food's main picture. Never rendered
 * in create mode (the drawer only mounts this once a `foodId` exists). The
 * parent renders this with `key={foodId}` (`IngredientDrawer.tsx`) so a
 * freshly-opened food always gets a clean mount.
 *
 * Upload/replace flow mirrors `Composer.tsx`'s chat-attachment pattern:
 * request a pre-signed URL, PUT the bytes directly to blob storage with a
 * bare `fetch` (never through the axios instance — a presigned URL doesn't
 * expect the API's Authorization header), then confirm the blob URL. Confirm
 * only runs after the PUT succeeds, and the ingredients queries are only
 * invalidated after confirm succeeds — a failure at any step shows a
 * translated error and leaves the previous picture unchanged. A drag-and-drop
 * onto the zone (empty or already holding a picture) runs the exact same
 * `processFile` path as the hidden file input.
 *
 * `imageUrl` seeds local state rather than being read directly: the parent
 * page (`IngredientsPage.tsx`) holds the selected food in a plain `useState`
 * snapshot taken when the row was clicked, which does NOT re-sync when the
 * list refetches after this component's own mutations invalidate it. Without
 * a local copy, a confirmed upload/remove would invalidate the query cache
 * correctly but the drawer would keep showing the pre-upload picture until
 * closed and reopened.
 */
export default function IngredientPictureField({ foodId, imageUrl, readOnly }: Props) {
  const { t } = useTranslation();
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire on every child element the pointer crosses, not
  // just the zone itself — a plain boolean would flicker `isDragOver` off
  // mid-drag whenever the pointer passes over the icon/text inside. Counting
  // enter/leave pairs and only clearing at zero keeps the highlight stable.
  const dragDepthRef = useRef(0);

  const version = useFoodImageVersion(foodId);
  const requestUploadUrlMutation = useRequestFoodImageUploadUrl();
  const confirmMutation = useConfirmFoodImage();
  const removeMutation = useRemoveFoodImage();

  const hasImage = Boolean(currentImageUrl);
  // Appends the cache-buster to the DISPLAYED src only — the blob URL sent to
  // confirmFoodImage (and `currentImageUrl` itself) never carries it. The
  // main picture's blob key is deterministic (foods/{id}.jpg), so a replace
  // keeps the same url and the browser would otherwise keep showing the
  // previous cached bytes.
  const displaySrc = currentImageUrl
    ? `${currentImageUrl}${currentImageUrl.includes('?') ? '&' : '?'}v=${version}`
    : null;
  const isBusy = isUploading || removeMutation.isPending;

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
      const { uploadUrl, blobUrl } = await requestUploadUrlMutation.mutateAsync({
        foodId,
        request: { contentType: file.type, sizeBytes: file.size },
      });
      if (!uploadUrl || !blobUrl) {
        throw new Error('Upload URL response missing uploadUrl/blobUrl');
      }

      // A plain fetch PUT to the pre-signed URL — never through the axios
      // instance, which would attach the API's Authorization header and a
      // Content-Type this presigned URL doesn't expect.
      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`Image upload PUT failed with status ${putResponse.status}`);
      }

      await confirmMutation.mutateAsync({ foodId, blobUrl });
      // Only set once confirm itself has succeeded — this is the local
      // mirror of the query cache's now-current imageUrl (see this
      // component's doc comment for why the prop alone isn't enough).
      setCurrentImageUrl(blobUrl);
    } catch (uploadError) {
      // Any failure here (minting the upload URL, the PUT itself, or the
      // confirm call) leaves the previous picture unchanged — the query
      // cache is only invalidated inside useConfirmFoodImage's onSuccess.
      showApiError(uploadError, 'ingredients.picture.uploadError');
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
    // Multiple files dropped at once → use the first, same as the file picker.
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    void processFile(file);
  }

  function handleRemoveConfirm() {
    removeMutation.mutate(foodId, {
      onSuccess: () => {
        setCurrentImageUrl(undefined);
        setRemoveConfirmOpen(false);
      },
    });
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
        {t('ingredients.picture.sectionLabel')}
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
                aria-label={t('ingredients.picture.viewPicture')}
                className="block size-full cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={displaySrc}
                  alt={t('ingredients.picture.alt')}
                  className="size-full object-cover"
                  onError={() => setLoadFailed(true)}
                />
              </button>
              <ImageLightbox
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                src={displaySrc}
                alt={t('ingredients.picture.alt')}
              />
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
                aria-label={t('ingredients.picture.replace')}
                title={t('ingredients.picture.replace')}
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                disabled={isBusy}
                aria-label={t('ingredients.picture.remove')}
                title={t('ingredients.picture.remove')}
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
          aria-label={t('ingredients.picture.upload')}
          title={t('ingredients.picture.upload')}
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
              <p className="text-body text-muted-foreground">{t('ingredients.picture.dropHint')}</p>
              <p className="text-meta text-muted-foreground">{t('ingredients.picture.dropLimits')}</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-meta text-destructive">{error}</p>}

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ingredients.picture.removeConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('ingredients.picture.removeConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={removeMutation.isPending} onClick={handleRemoveConfirm}>
              {t('ingredients.picture.removeConfirmSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
