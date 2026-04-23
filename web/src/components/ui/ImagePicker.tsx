import { useRef, useState, useCallback, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toast';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImagePickerProps {
  /** 'avatar' => square canvas-crop on submit; 'free' => original aspect. Default: 'free' */
  mode?: 'avatar' | 'free';
  /** Max file size in bytes. Default: 5 MiB */
  maxBytes?: number;
  /** Accepted MIME types. Default: ['image/jpeg', 'image/png', 'image/webp'] */
  accept?: string[];
  /**
   * Called when the user has confirmed a file.
   * Returns the signed upload URL and the final blob URL that will be emitted
   * via onUploaded after the PUT completes.
   */
  requestUploadUrl: (args: {
    contentType: string;
    sizeBytes: number;
  }) => Promise<{ uploadUrl: string; blobUrl: string }>;
  /** Fired after the PUT succeeds. */
  onUploaded: (blobUrl: string) => void;
  /** Optional initial preview (e.g. existing avatar URL). */
  initialPreviewUrl?: string;
  /** Optional className for the outer wrapper. */
  className?: string;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Canvas crop helper ───────────────────────────────────────────────────────

/**
 * Center-crops an image file to a square using an offscreen canvas.
 * Returns a Blob of the same MIME type as the input file.
 */
async function centerCropToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        },
        file.type,
        0.92,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image failed to load'));
    };

    img.src = objectUrl;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImagePicker({
  mode = 'free',
  maxBytes = DEFAULT_MAX_BYTES,
  accept = DEFAULT_ACCEPT,
  requestUploadUrl,
  onUploaded,
  initialPreviewUrl,
  className,
}: ImagePickerProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const inputId = useId();
  const labelId = useId();
  const errorId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreviewUrl ?? null,
  );
  // pendingFile is ONLY set in mode='avatar' — it's the buffer between "user
  // picked a file" and "user clicked Confirm to commit the square crop". In
  // mode='free', picking a file kicks off the upload immediately, so there's
  // no intermediate state and no Confirm/Cancel buttons to render.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  // ── Upload (shared by both modes) ─────────────────────────────────────────
  //
  // Defined before processFile so processFile can call it directly in free
  // mode without a dependency cycle.

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        let blobToUpload: Blob = file;

        if (mode === 'avatar') {
          blobToUpload = await centerCropToSquare(file);
        }

        const { uploadUrl, blobUrl } = await requestUploadUrl({
          contentType: file.type,
          sizeBytes: blobToUpload.size,
        });

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: blobToUpload,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        onUploaded(blobUrl);
        setPendingFile(null);
        // Swap the local preview for the committed blob URL
        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
        setPreviewUrl(blobUrl);
      } catch {
        addToast(t('imagePicker.errors.uploadFailed'), 'error');
      } finally {
        setIsUploading(false);
      }
    },
    [mode, requestUploadUrl, onUploaded, addToast, t],
  );

  // ── File validation & preview ─────────────────────────────────────────────

  const processFile = useCallback(
    (file: File) => {
      setValidationError(null);

      if (!accept.includes(file.type)) {
        setValidationError(
          t('imagePicker.errors.invalidType', {
            types: accept.map((m) => m.replace('image/', '')).join(', '),
          }),
        );
        return;
      }

      if (file.size > maxBytes) {
        const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
        setValidationError(
          t('imagePicker.errors.tooLarge', { limitMb }),
        );
        return;
      }

      // Revoke previous object URL before creating a new one
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);

      if (mode === 'avatar') {
        // Two-step: buffer the file, wait for user to click Confirm so they
        // can verify the centre-square crop preview before it uploads.
        setPendingFile(file);
      } else {
        // Auto-upload. The preview stays visible (with spinner overlay)
        // until the PUT resolves; on success uploadFile swaps preview to
        // the committed blob URL, on failure it shows a toast and the
        // user can pick another file to retry.
        uploadFile(file);
      }
    },
    [accept, maxBytes, mode, uploadFile, t],
  );

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only dismiss if leaving the drop zone itself (not a child element)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ── Keyboard activation of the drop zone ─────────────────────────────────

  const handleZoneKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isUploading) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [isUploading],
  );

  // ── File input change ─────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset the input so the same file can be re-selected after an error
      e.target.value = '';
    },
    [processFile],
  );

  // ── Confirm (avatar mode only) ────────────────────────────────────────────
  //
  // Only wired up when pendingFile is set, which only happens in
  // mode='avatar'. Forwards to the shared uploadFile helper.

  const handleConfirm = useCallback(() => {
    if (pendingFile) uploadFile(pendingFile);
  }, [pendingFile, uploadFile]);

  const handleCancel = useCallback(() => {
    setPendingFile(null);
    setValidationError(null);
    // Revert preview to initial or clear
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(initialPreviewUrl ?? null);
  }, [initialPreviewUrl]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasPreview = previewUrl !== null;
  const hasPending = pendingFile !== null;
  const acceptString = accept.join(',');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptString}
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Visible label (screen-reader pairing) */}
      <span id={labelId} className="sr-only">
        {mode === 'avatar'
          ? t('imagePicker.labelAvatar')
          : t('imagePicker.label')}
      </span>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={validationError ? errorId : undefined}
        aria-disabled={isUploading}
        onKeyDown={handleZoneKeyDown}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          // Base
          'relative flex flex-col items-center justify-center gap-2',
          'rounded-md border-2 border-dashed transition-colors duration-150 cursor-pointer',
          'min-h-[120px] p-4 text-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          // Color states (token-only, no hex literals)
          isDragOver
            ? 'border-accent bg-accent-bg'
            : 'border-border-md bg-bg2 hover:bg-bg-hover hover:border-border-hv',
          isUploading && 'pointer-events-none opacity-60',
          // Avatar mode: circle clip for preview
          mode === 'avatar' && hasPreview && 'overflow-hidden rounded-full',
        )}
      >
        {hasPreview ? (
          <img
            src={previewUrl}
            alt={t('imagePicker.previewAlt')}
            className={cn(
              'object-cover',
              mode === 'avatar'
                ? 'h-24 w-24 rounded-full'
                : 'max-h-48 max-w-full rounded-sm',
            )}
          />
        ) : (
          <>
            {/* Upload icon (inline SVG — no extra dep) */}
            <svg
              aria-hidden="true"
              className="h-8 w-8 text-text3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-text2">
              {isDragOver
                ? t('imagePicker.dropHere')
                : t('imagePicker.dragOrClick')}
            </p>
            <p className="text-xs text-text3">
              {t('imagePicker.hint', {
                types: accept
                  .map((m) => m.replace('image/', '').toUpperCase())
                  .join(', '),
                limitMb: (maxBytes / (1024 * 1024)).toFixed(0),
              })}
            </p>
          </>
        )}

        {/* Spinning overlay while uploading */}
        {isUploading && (
          <div
            aria-live="polite"
            aria-label={t('imagePicker.uploading')}
            className="absolute inset-0 flex items-center justify-center rounded-md bg-bg/70"
          >
            <svg
              className="h-6 w-6 animate-spin text-accent"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-red"
        >
          {validationError}
        </p>
      )}

      {/* Action row — shown only when a file is pending */}
      {hasPending && !isUploading && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              'inline-flex items-center gap-[5px] rounded-md px-2.5 py-[5px]',
              'text-[13px] font-medium border border-transparent transition-colors duration-100',
              'bg-text text-bg hover:opacity-85 cursor-pointer',
            )}
          >
            {t('imagePicker.confirm')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              'inline-flex items-center gap-[5px] rounded-md px-2.5 py-[5px]',
              'text-[13px] font-medium border transition-colors duration-100 cursor-pointer',
              'border-border-md bg-bg text-text hover:bg-bg-hover',
            )}
          >
            {t('imagePicker.cancelSelection')}
          </button>
        </div>
      )}

      {/* Change photo link — shown when preview exists and no pending selection */}
      {hasPreview && !hasPending && !isUploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start text-xs text-text2 hover:text-text underline-offset-2 hover:underline transition-colors duration-100 cursor-pointer"
        >
          {t('imagePicker.change')}
        </button>
      )}
    </div>
  );
}
