import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { cn } from '@/lib/utils';
import GalleryGrid from '@/components/library/GalleryGrid';
import { FILE_PICKER_ACCEPT, type StagedPictures } from '@/components/library/pictureUpload';

interface Props {
  staged: StagedPictures;
  /** Locks every control, e.g. while the saved item's pictures are uploading. */
  disabled: boolean;
  /** Alt text for the main picture preview. */
  alt: string;
  /** Prefix of the gallery test ids, e.g. `recipe-gallery`. */
  testIdPrefix: string;
}

/**
 * The create-mode Pictures tab: the main picture and up to six extras are picked
 * and previewed in the browser, then uploaded by the parent once the item exists.
 */
export default function StagedPicturesField({ staged, disabled, alt, testIdPrefix }: Props) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire on every child element the pointer crosses — count pairs to avoid flicker.
  const dragDepthRef = useRef(0);

  const viewerImages = [...(staged.main ? [staged.main.previewUrl] : []), ...staged.extras.map((p) => p.previewUrl)];
  const galleryOffset = staged.main ? 1 : 0;
  // Removing a picture can shrink the list under an open viewer; treat an out-of-range index as closed.
  const openIndex = viewerIndex !== null && viewerIndex < viewerImages.length ? viewerIndex : null;

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file after a rejection fires onChange again.
    event.target.value = '';
    if (file) {
      staged.setMainFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const file = disabled ? undefined : event.dataTransfer.files?.[0];
    if (file) {
      staged.setMainFile(file);
    }
  }

  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!disabled) {
        dragDepthRef.current += 1;
        setIsDragOver(true);
      }
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragOver(false);
      }
    },
    onDrop: handleDrop,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-copy font-semibold text-foreground">
          <ImageIcon className="size-4.25 text-nutrition" aria-hidden="true" />
          {t('library.picture.sectionLabel')}
        </h3>

        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          data-testid="staged-main-input"
          onChange={handleFileSelected}
        />

        {staged.main ? (
          <div
            className={cn(
              'relative h-37.5 w-full overflow-hidden rounded-xl bg-muted',
              isDragOver && 'ring-2 ring-primary',
            )}
            {...dropHandlers}
          >
            <button
              type="button"
              aria-label={t('library.picture.viewPicture')}
              className="block size-full cursor-zoom-in"
              onClick={() => setViewerIndex(0)}
            >
              <img src={staged.main.previewUrl} alt={alt} className="size-full object-cover" />
            </button>
            <div className="absolute top-2 right-2 flex gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-8.5 rounded-lg bg-surface text-ink shadow-popover"
                disabled={disabled}
                aria-label={t('library.picture.replace')}
                title={t('library.picture.replace')}
                onClick={() => fileInputRef.current?.click()}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-8.5 rounded-lg bg-surface text-error shadow-popover"
                disabled={disabled}
                aria-label={t('library.picture.remove')}
                title={t('library.picture.remove')}
                onClick={() => staged.removeMain()}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label={t('library.picture.upload')}
            title={t('library.picture.upload')}
            aria-disabled={disabled}
            className={cn(
              'flex h-37.5 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted p-6 text-center transition-colors',
              !disabled && 'cursor-pointer',
              isDragOver && 'border-primary bg-primary/5',
              disabled && 'pointer-events-none opacity-50',
            )}
            onClick={() => {
              if (!disabled) {
                fileInputRef.current?.click();
              }
            }}
            onKeyDown={(event) => {
              if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            {...dropHandlers}
          >
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-body text-muted-foreground">{t('library.picture.dropHint')}</p>
            <p className="text-meta text-muted-foreground">{t('library.picture.dropLimits')}</p>
          </div>
        )}
      </div>

      <GalleryGrid
        imageUrls={staged.extras.map((picture) => picture.previewUrl)}
        readOnly={false}
        disabled={disabled}
        testIdPrefix={testIdPrefix}
        onView={(galleryIndex) => setViewerIndex(galleryIndex + galleryOffset)}
        uploadFile={async (file) => staged.addExtraFiles([file])}
        removeImage={async (previewUrl) => {
          const target = staged.extras.find((picture) => picture.previewUrl === previewUrl);
          if (target) {
            staged.removeExtra(target.id);
          }
        }}
        promoteImage={async (previewUrl) => {
          const target = staged.extras.find((picture) => picture.previewUrl === previewUrl);
          if (target) {
            staged.promoteExtra(target.id);
          }
        }}
      />

      {openIndex !== null && (
        <ImageLightbox
          open
          onOpenChange={(open) => !open && setViewerIndex(null)}
          src={viewerImages[openIndex] ?? ''}
          alt={alt}
          gallery={{ images: viewerImages, index: openIndex, onIndexChange: setViewerIndex }}
        />
      )}
    </div>
  );
}
