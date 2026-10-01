import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
 * The ingredient drawer's picture area (#1140) — upload, replace, and
 * remove a food's main picture. Never rendered in create mode (the drawer
 * only mounts this once a `foodId` exists). The parent renders this with
 * `key={foodId}` (`IngredientDrawer.tsx`) so a freshly-opened food always
 * gets a clean mount.
 *
 * Upload/replace flow mirrors `Composer.tsx`'s chat-attachment pattern:
 * request a pre-signed URL, PUT the bytes directly to blob storage with a
 * bare `fetch` (never through the axios instance — a presigned URL doesn't
 * expect the API's Authorization header), then confirm the blob URL. Confirm
 * only runs after the PUT succeeds, and the ingredients queries are only
 * invalidated after confirm succeeds — a failure at any step shows a
 * translated error and leaves the previous picture unchanged.
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so re-selecting the same file after an error fires onChange again.
    event.target.value = '';
    if (!file) {
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

  function handleRemoveConfirm() {
    removeMutation.mutate(foodId, {
      onSuccess: () => {
        setCurrentImageUrl(undefined);
        setRemoveConfirmOpen(false);
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-foreground">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('ingredients.picture.sectionLabel')}
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {displaySrc && !loadFailed ? (
            <img
              src={displaySrc}
              alt={t('ingredients.picture.alt')}
              className="size-full object-cover"
              onError={() => setLoadFailed(true)}
            />
          ) : (
            <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_PICKER_ACCEPT}
              className="hidden"
              onChange={(event) => void handleFileSelected(event)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {hasImage ? t('ingredients.picture.replace') : t('ingredients.picture.upload')}
            </Button>
            {hasImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setRemoveConfirmOpen(true)}
              >
                {t('ingredients.picture.remove')}
              </Button>
            )}
            {error && <p className="text-meta text-destructive">{error}</p>}
          </div>
        )}
      </div>

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
