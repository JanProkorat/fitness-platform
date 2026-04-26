/**
 * PlanPhotosTab — Photos tab for the NutritionPlanPage.
 *
 * Shows a category chip row (Food / Body / FreeForm) and a 3-column thumbnail
 * grid loaded via TanStack Query. Clicking a thumbnail opens the ImageLightbox.
 * SignalR invalidation is handled at the AppShell level.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { getPlanPhotos } from '@/api/photos';
import { PlanPhotoCategory } from '@/api/generated';

interface PlanPhotosTabProps {
  planId: string;
}

const CATEGORIES: Array<{ key: PlanPhotoCategory | null; labelKey: string }> = [
  { key: null, labelKey: 'nutrition.photos.categoryAll' },
  { key: PlanPhotoCategory.Food, labelKey: 'nutrition.photos.categoryFood' },
  { key: PlanPhotoCategory.Body, labelKey: 'nutrition.photos.categoryBody' },
  { key: PlanPhotoCategory.FreeForm, labelKey: 'nutrition.photos.categoryFreeForm' },
];

const PAGE_SIZE = 60;

export function PlanPhotosTab({ planId }: PlanPhotosTabProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<PlanPhotoCategory | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['planPhotos', planId, activeCategory],
    queryFn: () => getPlanPhotos(planId, 1, PAGE_SIZE, activeCategory),
    staleTime: 30_000,
  });

  const imageUrls = useMemo(
    () => photos.map((p) => p.blobUrl ?? '').filter(Boolean),
    [photos],
  );

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Category chips */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-border">
        {CATEGORIES.map(({ key, labelKey }) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={String(key)}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={cn(
                'px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
                isActive
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
              )}
            >
              {t(labelKey)}
              {isActive && photos.length > 0 && (
                <span className="ml-1 opacity-70">({photos.length})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Photo grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading && (
          <div className="text-center py-12 text-[13px] text-text3">
            {t('common.loading')}
          </div>
        )}

        {!isLoading && photos.length === 0 && (
          <div className="text-center py-16">
            <div className="text-[32px] mb-3">📷</div>
            <div className="text-[14px] font-medium text-text2 mb-1">
              {t('nutrition.photos.emptyTitle')}
            </div>
            <div className="text-[12px] text-text3">
              {t('nutrition.photos.emptyHint')}
            </div>
          </div>
        )}

        {!isLoading && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <button
                key={photo.id ?? idx}
                type="button"
                className={cn(
                  'relative aspect-square rounded-md overflow-hidden',
                  'border border-border hover:border-border-md',
                  'bg-bg2 transition-all duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
                onClick={() => openLightbox(idx)}
                title={photo.description ?? t('nutrition.photos.viewPhoto')}
              >
                {photo.blobUrl ? (
                  <img
                    src={photo.blobUrl}
                    alt={photo.description ?? `${t('nutrition.photos.photoAlt')} ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text4 text-[20px]">
                    📷
                  </div>
                )}
                {/* Category badge */}
                {photo.category && (
                  <span className={cn(
                    'absolute top-1 left-1 text-[9px] font-semibold px-[5px] py-[1px] rounded-full',
                    // Semantic tokens from index.css — matches Tag component orange/blue/purple variants
                    photo.category === PlanPhotoCategory.Food && 'bg-orange-bg text-orange',
                    photo.category === PlanPhotoCategory.Body && 'bg-blue-bg text-blue',
                    photo.category === PlanPhotoCategory.FreeForm && 'bg-purple-bg text-purple',
                  )}>
                    {t(`nutrition.photos.badge${photo.category}`)}
                  </span>
                )}
                {/* Date overlay */}
                {photo.takenAt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-0.5 text-[9px] text-white/90 text-right">
                    {new Date(photo.takenAt).toLocaleDateString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={imageUrls}
        startIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={t('nutrition.photos.photoAlt')}
      />
    </div>
  );
}
