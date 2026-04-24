/**
 * ImageLightbox — fullscreen modal that displays an image (or a set of images)
 * at natural size, with keyboard + button navigation.
 *
 * Use cases:
 *   - Food detail: single image (main).
 *   - Recipe detail: main + up to 6 gallery entries, opened at a chosen index.
 *   - Any other full-bleed preview where the surrounding card crops the image.
 *
 * A11y:
 *   - role="dialog", aria-modal, aria-label from i18n.
 *   - Esc closes, ArrowLeft / ArrowRight navigate, focus trapped inside.
 *   - Close button + (for multi-image) prev / next buttons have labels.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageLightboxProps {
  /** Ordered list of image URLs to cycle through. Empty list → nothing rendered. */
  images: string[];
  /** Zero-based index of the image to show first. Clamped to the array bounds. */
  startIndex?: number;
  /** Whether the lightbox is open. Controlled by the parent. */
  open: boolean;
  /** Called when the user dismisses the lightbox (Esc, click-outside, close button). */
  onClose: () => void;
  /** Optional alt-text prefix. A running index suffix is appended for multi-image. */
  altPrefix?: string;
}

export function ImageLightbox({
  images,
  startIndex = 0,
  open,
  onClose,
  altPrefix,
}: ImageLightboxProps) {
  if (!open || images.length === 0) return null;

  // Re-mount the inner viewer each time the parent changes startIndex (or the
  // list length). The `key` forces a fresh initial `useState`, so we don't
  // need a post-mount effect to reset the displayed index — which would trip
  // `react-hooks/set-state-in-effect`.
  return (
    <LightboxViewer
      key={`${startIndex}-${images.length}`}
      images={images}
      startIndex={startIndex}
      onClose={onClose}
      altPrefix={altPrefix}
    />
  );
}

// ─── Inner viewer — assumes `open` is true ───────────────────────────────────

interface ViewerProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
  altPrefix?: string;
}

function LightboxViewer({ images, startIndex, onClose, altPrefix }: ViewerProps) {
  const { t } = useTranslation();
  const multi = images.length > 1;

  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(startIndex, images.length - 1)),
  );

  const showPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const showNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard: Esc to close, Left/Right to navigate (multi only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (multi && e.key === 'ArrowLeft') {
        e.preventDefault();
        showPrev();
      } else if (multi && e.key === 'ArrowRight') {
        e.preventDefault();
        showNext();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [multi, onClose, showPrev, showNext]);

  const currentSrc = images[index];
  const alt = altPrefix ? `${altPrefix} ${index + 1} / ${images.length}` : '';

  return (
    <>
      {/* Backdrop — catches clicks-outside to dismiss */}
      <div
        className="fixed inset-0 z-[70] bg-black/90"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Lightbox surface */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('imageLightbox.dialogLabel')}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        {/* Close button (top-right) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('imageLightbox.close')}
          className={cn(
            'pointer-events-auto absolute right-4 top-4',
            'flex h-10 w-10 items-center justify-center rounded-full',
            'bg-white/10 text-white hover:bg-white/20 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
          )}
        >
          <CloseIcon />
        </button>

        {/* Image */}
        <img
          src={currentSrc}
          alt={alt}
          className="pointer-events-auto max-h-full max-w-full object-contain rounded-sm"
        />

        {/* Prev / Next (only when more than one image) */}
        {multi && (
          <>
            <button
              type="button"
              onClick={showPrev}
              aria-label={t('imageLightbox.prev')}
              className={cn(
                'pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2',
                'flex h-12 w-12 items-center justify-center rounded-full',
                'bg-white/10 text-white hover:bg-white/20 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              )}
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label={t('imageLightbox.next')}
              className={cn(
                'pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2',
                'flex h-12 w-12 items-center justify-center rounded-full',
                'bg-white/10 text-white hover:bg-white/20 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
              )}
            >
              <ChevronIcon direction="right" />
            </button>

            {/* Counter */}
            <div
              className={cn(
                'pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2',
                'rounded-full bg-white/10 px-3 py-1 text-xs text-white/90',
              )}
              aria-live="polite"
            >
              {index + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Icons (inline SVG so no external dep) ───────────────────────────────────

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className="h-6 w-6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
