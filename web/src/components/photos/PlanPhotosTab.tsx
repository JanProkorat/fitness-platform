/**
 * PlanPhotosTab — Photos tab shared by NutritionPlanPage and TrainingPlanPage.
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
import { CardGrid, Card, CardBody } from '@/components/data';

interface PlanPhotosTabProps {
  planId: string;
  /** Client (profile) public id. Required because the web portal hits the
   *  trainer endpoint (`/trainer/clients/{clientId}/photos`). */
  clientId: string;
}

const CATEGORIES: Array<{ key: PlanPhotoCategory | null; labelKey: string }> = [
  { key: null, labelKey: 'nutrition.photos.categoryAll' },
  { key: PlanPhotoCategory.Food, labelKey: 'nutrition.photos.categoryFood' },
  { key: PlanPhotoCategory.Body, labelKey: 'nutrition.photos.categoryBody' },
  { key: PlanPhotoCategory.FreeForm, labelKey: 'nutrition.photos.categoryFreeForm' },
];

const PAGE_SIZE = 60;

export function PlanPhotosTab({ planId, clientId }: PlanPhotosTabProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<PlanPhotoCategory | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Fetch the full (unfiltered) photo list once. Filtering by category
  // happens client-side so all per-category counts stay visible regardless
  // of which chip is selected — re-fetching per filter would give us only
  // the active set and we couldn't show the others' counts.
  const { data: allPhotos = [], isLoading } = useQuery({
    queryKey: ['planPhotos', clientId, planId],
    queryFn: () => getPlanPhotos(clientId, planId, 1, PAGE_SIZE, null),
    enabled: !!clientId && !!planId,
    staleTime: 30_000,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: allPhotos.length };
    for (const p of allPhotos) {
      if (p.category != null) c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [allPhotos]);

  const photos = useMemo(
    () => (activeCategory == null ? allPhotos : allPhotos.filter((p) => p.category === activeCategory)),
    [allPhotos, activeCategory],
  );

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
      {/* Category chips — sized to match the page-level tabs (Jídelníček / Fotky) */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border">
        {CATEGORIES.map(({ key, labelKey }) => {
          const isActive = activeCategory === key;
          const count = counts[key === null ? 'All' : key] ?? 0;
          return (
            <button
              key={String(key)}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
                isActive
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
              )}
            >
              <span>{t(labelKey)}</span>
              <span className={cn('tabular-nums', isActive ? 'opacity-90' : 'opacity-70')}>
                ({count})
              </span>
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
          <CardGrid>
            {photos.map((photo, idx) => (
              <Card key={photo.id ?? idx} onClick={() => openLightbox(idx)}>
                {/* Cover — same h-40 as food/recipe/client cards */}
                <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
                  {photo.blobUrl ? (
                    <img
                      src={photo.blobUrl}
                      alt={photo.description ?? `${t('nutrition.photos.photoAlt')} ${idx + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
                      📷
                    </div>
                  )}
                  {/* Category chip — top-right, mirroring food/recipe pattern */}
                  {photo.category && (
                    <div
                      className={cn(
                        'absolute top-2 right-2 inline-flex items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm px-2 py-0.5 text-[11px] font-medium',
                        photo.category === PlanPhotoCategory.Food && 'text-orange',
                        photo.category === PlanPhotoCategory.Body && 'text-blue',
                        photo.category === PlanPhotoCategory.FreeForm && 'text-purple',
                      )}
                    >
                      {t(`nutrition.photos.badge${photo.category}`)}
                    </div>
                  )}
                  {/* Bottom gradient shows description (caption) when present */}
                  {photo.description && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
                      <div className="line-clamp-2 text-[12px] font-medium text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                        {photo.description}
                      </div>
                    </div>
                  )}
                </div>
                <CardBody>
                  <div className="text-[11px] text-text3 tabular-nums">
                    {photo.takenAt
                      ? new Date(photo.takenAt).toLocaleDateString()
                      : '—'}
                  </div>
                </CardBody>
              </Card>
            ))}
          </CardGrid>
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
