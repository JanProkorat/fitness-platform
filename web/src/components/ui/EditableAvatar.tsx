/**
 * EditableAvatar
 *
 * Composable avatar that shows a photo (src) or initials fallback, and
 * optionally an interactive camera-badge overlay (editable=true) for
 * own-profile surfaces.
 *
 * Design-of-record:
 *   docs/prototypes/notion/scenes/profile.html  — trainer web portal
 *   docs/prototypes/trainer/scenes/profil.html   — mobile trainer profile
 *
 * Badge position: absolute bottom-right, gold circle with camera SVG,
 * 3-px border matching the card background.
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePicker } from './ImagePicker';
import { Dialog } from './Dialog';
import { cn } from '@/lib/cn';
import type { ImagePickerProps } from './ImagePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface EditableAvatarProps {
  /** Current avatar URL. When falsy, renders initials fallback. */
  src?: string | null;
  /** Initials to render when src is absent (e.g. "MT"). */
  initials: string;
  /** Visual size variant. Defaults to 'lg'. */
  size?: AvatarSize;
  /**
   * When true, renders a camera-badge overlay that opens the ImagePicker
   * dialog. Must only be true on own-profile surfaces.
   */
  editable?: boolean;
  /**
   * Called with the committed blobUrl after the upload is confirmed by the
   * server. The caller is responsible for calling the confirm endpoint and
   * invalidating its query cache.
   */
  onUploaded?: (blobUrl: string) => void;
  /**
   * Passed straight through to `<ImagePicker requestUploadUrl={...}>`.
   * Required when editable=true.
   */
  requestUploadUrl?: ImagePickerProps['requestUploadUrl'];
  /** Optional extra classes on the outer wrapper. */
  className?: string;
}

// ─── Size tokens ─────────────────────────────────────────────────────────────

const SIZE: Record<AvatarSize, { wrap: string; text: string; badge: string }> = {
  sm: { wrap: 'w-8 h-8 text-xs',        text: 'text-xs',   badge: 'w-5 h-5 text-[9px] -right-[3px] -bottom-[3px]' },
  md: { wrap: 'w-10 h-10',              text: 'text-sm',   badge: 'w-6 h-6 text-[10px] -right-[3px] -bottom-[3px]' },
  lg: { wrap: 'w-[84px] h-[84px]',      text: 'text-3xl',  badge: 'w-[28px] h-[28px] text-[13px] -right-[2px] -bottom-[2px]' },
  xl: { wrap: 'w-[100px] h-[100px]',    text: 'text-4xl',  badge: 'w-8 h-8 text-[14px] -right-[3px] -bottom-[3px]' },
};

// ─── Camera icon (inline SVG — no external dependency) ────────────────────────

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-[55%] h-[55%]"
    >
      <path d="M9 3L7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditableAvatar({
  src,
  initials,
  size = 'lg',
  editable = false,
  onUploaded,
  requestUploadUrl,
  className,
}: EditableAvatarProps) {
  const { t } = useTranslation();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(src ?? null);

  // Keep currentSrc in sync when the prop changes (e.g. after query refetch)
  const prevSrcRef = useRef(src);
  if (src !== prevSrcRef.current) {
    prevSrcRef.current = src;
    setCurrentSrc(src ?? null);
  }

  const sz = SIZE[size];

  /**
   * Called by ImagePicker once the PUT to the presigned URL succeeds.
   * Optimistically updates the displayed image and forwards the blobUrl to the
   * parent via onUploaded — the parent is responsible for confirming the upload
   * and showing success/error toasts.
   */
  const handleUploaded = useCallback(
    (blobUrl: string) => {
      setCurrentSrc(blobUrl);
      setPickerOpen(false);
      onUploaded?.(blobUrl);
    },
    [onUploaded],
  );

  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerOpen(true);
  }, []);

  const handleBadgeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPickerOpen(true);
    }
  }, []);

  return (
    <>
      {/* ── Avatar wrapper ── */}
      <div className={cn('relative inline-flex shrink-0', className)}>
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold overflow-hidden',
            'bg-accent/15 text-accent',
            sz.wrap,
            sz.text,
          )}
        >
          {currentSrc ? (
            <img
              src={currentSrc}
              alt={initials}
              className="w-full h-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>

        {/* ── Camera badge (own-profile only) ── */}
        {editable && (
          <button
            type="button"
            aria-label={t('avatar.changeBadgeLabel')}
            title={t('avatar.changeBadgeLabel')}
            onClick={handleBadgeClick}
            onKeyDown={handleBadgeKeyDown}
            className={cn(
              'absolute rounded-full',
              'bg-accent text-white border-[3px] border-bg2',
              'flex items-center justify-center',
              'cursor-pointer hover:opacity-90 transition-opacity',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
              sz.badge,
            )}
          >
            <CameraIcon />
          </button>
        )}
      </div>

      {/* ── Picker dialog ── */}
      {editable && requestUploadUrl && (
        <Dialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={t('avatar.dialogTitle')}
          maxWidth={480}
        >
          <ImagePicker
            mode="avatar"
            requestUploadUrl={requestUploadUrl}
            onUploaded={handleUploaded}
            initialPreviewUrl={currentSrc ?? undefined}
          />
        </Dialog>
      )}
    </>
  );
}
