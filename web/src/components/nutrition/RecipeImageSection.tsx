import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { requestRecipeImageUploadUrl, confirmRecipeImage } from '@/api/recipes';
import type { RecipeImageSlot } from '@/api/recipe-types';
import { useToastStore } from '@/stores/toast';

const GALLERY_MAX = 6;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 5 * 1024 * 1024;

// ─── Shared upload logic ──────────────────────────────────────────────────────

async function uploadImage(
  file: File,
  requestUrl: () => Promise<{ uploadUrl: string; blobUrl: string }>,
): Promise<string> {
  const { uploadUrl, blobUrl } = await requestUrl();

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return blobUrl;
}

// ─── Mini picker for a single slot ───────────────────────────────────────────

interface SlotPickerProps {
  accept: string;
  maxBytes: number;
  disabled: boolean;
  onFile: (file: File) => void;
  /** data-testid forwarded to the hidden file input for E2E targeting. */
  testId?: string;
}

function SlotPicker({ accept, maxBytes, disabled, onFile, testId }: SlotPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!ACCEPT.includes(file.type) || file.size > maxBytes) return;
    onFile(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        data-testid={testId}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex h-full w-full items-center justify-center rounded-md border-2 border-dashed transition-colors hover:border-border-hv hover:bg-bg-hover disabled:pointer-events-none disabled:opacity-40"
        style={{ borderColor: 'var(--border-md)', background: 'var(--bg2)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ color: 'var(--text3)' }}>
          <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
          <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

interface ThumbnailProps {
  src: string;
  index: number;
}

function Thumbnail({ src, index }: ThumbnailProps) {
  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{ width: 72, height: 72, background: 'var(--bg3)', flexShrink: 0 }}
      aria-label={`Gallery image ${index + 1}`}
    >
      <img
        src={src}
        alt={`Gallery photo ${index + 1}`}
        className="h-full w-full object-cover"
        data-testid={`recipe-gallery-thumbnail-${index}`}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface RecipeImageSectionProps {
  recipeId: string;
  /** Current hero image URL. Pass null/undefined for none. */
  imageUrl?: string | null;
  /** Current gallery image URLs (up to 6). */
  galleryImageUrls?: string[];
  /** Whether the current user owns this recipe (only owners can upload). */
  isOwner: boolean;
  /** Called after a successful upload so the parent can reload the recipe. */
  onUploaded: (slot: RecipeImageSlot) => void;
}

export function RecipeImageSection({
  recipeId,
  imageUrl,
  galleryImageUrls = [],
  isOwner,
  onUploaded,
}: RecipeImageSectionProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const acceptString = ACCEPT.join(',');
  const galleryFull = galleryImageUrls.length >= GALLERY_MAX;

  // ── Main image upload ────────────────────────────────────────────────────

  const handleMainFile = useCallback(
    async (file: File) => {
      setUploadingMain(true);
      try {
        const blobUrl = await uploadImage(file, () =>
          requestRecipeImageUploadUrl(recipeId, 'main', {
            contentType: file.type,
            sizeBytes: file.size,
          }),
        );
        await confirmRecipeImage(recipeId, 'main', { blobUrl });
        addToast(t('recipes.image.uploadMainSuccess'), 'success');
        onUploaded('main');
      } catch {
        addToast(t('recipes.image.uploadMainError'), 'error');
      } finally {
        setUploadingMain(false);
      }
    },
    [recipeId, onUploaded, addToast, t],
  );

  // ── Gallery image upload ─────────────────────────────────────────────────

  const handleGalleryFile = useCallback(
    async (file: File) => {
      if (galleryFull) {
        addToast(t('recipes.image.galleryFull'), 'error');
        return;
      }
      setUploadingGallery(true);
      try {
        const blobUrl = await uploadImage(file, () =>
          requestRecipeImageUploadUrl(recipeId, 'gallery', {
            contentType: file.type,
            sizeBytes: file.size,
          }),
        );
        await confirmRecipeImage(recipeId, 'gallery', { blobUrl });
        addToast(t('recipes.image.uploadGallerySuccess'), 'success');
        onUploaded('gallery');
      } catch {
        addToast(t('recipes.image.uploadGalleryError'), 'error');
      } finally {
        setUploadingGallery(false);
      }
    },
    [recipeId, galleryFull, onUploaded, addToast, t],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div>
        <div className="mb-1.5 text-xs font-medium" style={{ color: 'var(--text3)' }}>
          {t('recipes.image.mainHeading')}
        </div>

        {imageUrl ? (
          <div className="relative overflow-hidden rounded-md" style={{ height: 140, background: 'var(--bg3)' }}>
            <img
              src={imageUrl}
              alt={t('recipes.image.mainHeading')}
              className="h-full w-full object-cover"
              data-testid="recipe-main-image"
            />
            {isOwner && (
              <div className="absolute bottom-2 right-2">
                <HiddenFileUpload
                  accept={acceptString}
                  maxBytes={MAX_BYTES}
                  disabled={uploadingMain}
                  onFile={handleMainFile}
                  label={t('imagePicker.change')}
                  compact
                />
              </div>
            )}
            {uploadingMain && <UploadOverlay />}
          </div>
        ) : isOwner ? (
          <div style={{ height: 100, position: 'relative' }}>
            <SlotPicker
              accept={acceptString}
              maxBytes={MAX_BYTES}
              disabled={uploadingMain}
              onFile={handleMainFile}
              testId="recipe-main-image-input"
            />
            {uploadingMain && <UploadOverlay />}
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-md text-xs"
            style={{ height: 60, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)' }}
          >
            {t('recipes.image.mainEmpty')}
          </div>
        )}
      </div>

      {/* Gallery */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
            {t('recipes.image.galleryHeading')}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text4)' }}>
            {galleryImageUrls.length}/{GALLERY_MAX}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Existing gallery images */}
          {galleryImageUrls.map((url, i) => (
            <Thumbnail key={url} src={url} index={i} />
          ))}

          {/* "+ Add photo" slot — visible to owner when gallery is not full */}
          {isOwner && (
            <div
              style={{ width: 72, height: 72, position: 'relative', flexShrink: 0 }}
              title={galleryFull ? t('recipes.image.galleryFull') : t('recipes.image.addPhoto')}
            >
              <SlotPicker
                accept={acceptString}
                maxBytes={MAX_BYTES}
                disabled={galleryFull || uploadingGallery}
                onFile={handleGalleryFile}
                testId="recipe-gallery-image-input"
              />
              {uploadingGallery && <UploadOverlay small />}
            </div>
          )}

          {/* Empty state for non-owners */}
          {!isOwner && galleryImageUrls.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--text3)', paddingTop: 4 }}>
              {t('recipes.image.galleryEmpty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface HiddenFileUploadProps {
  accept: string;
  maxBytes: number;
  disabled: boolean;
  onFile: (file: File) => void;
  label: string;
  compact?: boolean;
}

function HiddenFileUpload({ accept, maxBytes, disabled, onFile, label, compact }: HiddenFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!ACCEPT.includes(file.type) || file.size > maxBytes) return;
    onFile(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 bg-black/55 text-white"
        style={{
          fontSize: compact ? 11 : 12,
        }}
      >
        {label}
      </button>
    </>
  );
}

interface UploadOverlayProps {
  small?: boolean;
}

function UploadOverlay({ small }: UploadOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-md bg-bg/70"
    >
      <svg
        className="animate-spin"
        style={{ width: small ? 16 : 20, height: small ? 16 : 20, color: 'var(--accent)' }}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}
