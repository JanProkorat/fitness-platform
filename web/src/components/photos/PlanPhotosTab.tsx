/**
 * PlanPhotosTab — Photos tab shared by NutritionPlanPage and TrainingPlanPage.
 *
 * Shows a category chip row (Food / Body / FreeForm) and a 3-column thumbnail
 * grid loaded via TanStack Query. Clicking a thumbnail opens the ImageLightbox.
 * SignalR invalidation is handled at the AppShell level.
 *
 * The "Request photo diary" CTA button at the top-right opens RequestDiaryDialog.
 * `linkId` is the internal integer PK of ClientProfessionalLink, passed in by the
 * parent page from the client-list or client-dashboard API response.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { Button } from '@/components/ui/Button';
import { getPlanPhotos } from '@/api/photos';
import { PlanPhotoCategory } from '@/api/generated';
import { CardGrid, Card, CardBody } from '@/components/data';
import { RequestDiaryDialog } from '@/components/diary/RequestDiaryDialog';
import { DiaryViewerPanel } from '@/components/diary/DiaryViewerPanel';
import { listDiaryRequests } from '@/api/diary-requests';

interface PlanPhotosTabProps {
  planId: string;
  /** Client (profile) public id. Required because the web portal hits the
   *  trainer endpoint (`/trainer/clients/{clientId}/photos`). */
  clientId: string;
  /** Display name of the client — shown in the diary request dialog's client strip. */
  clientName?: string;
  /**
   * Internal integer PK of ClientProfessionalLink.
   * Sourced from the client-list or client-dashboard API response.
   */
  linkId?: number | null;
  /**
   * When false, the Food category chip is hidden from the filter row.
   * Use for training plans where food photos are not relevant.
   * Defaults to true (Food chip shown) so NutritionPlanPage needs no change.
   * Note: the "All" chip is always shown and continues to include any
   * Food-categorised photos already on the plan (orphan-photo safety).
   */
  allowFoodCategory?: boolean;
}

// Sentinel for the dedicated diaries tab — sits in the same chip row as the
// photo categories so the trainer can switch to the diary list without
// scrolling past it. Active diaries (Pending) still render as a sticky banner
// above the photo grid on every photo-category tab so they stay visible.
type DiariesTab = 'Diaries';
type ActiveTab = PlanPhotoCategory | null | DiariesTab;

const CATEGORIES: Array<{ key: PlanPhotoCategory | null; labelKey: string }> = [
  { key: null, labelKey: 'nutrition.photos.categoryAll' },
  { key: PlanPhotoCategory.Food, labelKey: 'nutrition.photos.categoryFood' },
  { key: PlanPhotoCategory.Body, labelKey: 'nutrition.photos.categoryBody' },
  { key: PlanPhotoCategory.FreeForm, labelKey: 'nutrition.photos.categoryFreeForm' },
];

const PAGE_SIZE = 60;

export function PlanPhotosTab({ planId, clientId, clientName, linkId, allowFoodCategory = true }: PlanPhotosTabProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const isDiariesTab = activeTab === 'Diaries';
  const activeCategory = isDiariesTab ? null : (activeTab as PlanPhotoCategory | null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [diaryDialogOpen, setDiaryDialogOpen] = useState(false);

  // Filter out the Food chip when the caller explicitly disallows it
  // (training plans). The "All" entry (key: null) is always kept so orphan
  // Food-categorised photos remain reachable under All.
  const visibleCategories = allowFoodCategory
    ? CATEGORIES
    : CATEGORIES.filter((c) => c.key !== PlanPhotoCategory.Food);

  const resolvedClientName = clientName ?? '';
  const clientInitials = resolvedClientName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

  // Mirror the DiaryViewerPanel's query so the chip can show a count without
  // an extra fetch — TanStack dedupes on identical queryKey + queryFn.
  const { data: diaryRequests = [] } = useQuery({
    queryKey: ['diary-requests', planId],
    queryFn: () => listDiaryRequests({ planId }),
    enabled: !!planId,
    staleTime: 30_000,
  });
  const diariesCount = diaryRequests.length;
  // Disable the "send request" CTA while a previous request is still in
  // flight — Pending (waiting on the client), Accepted (chosen mode but
  // nothing uploaded yet), or InProgress (mid-upload). Stacking new
  // requests on top of an active one isn't useful — the trainer should
  // wait for that one to complete or be dismissed first.
  const hasInFlightDiary = diaryRequests.some(
    (r) => r.status === 'Pending' || r.status === 'Accepted' || r.status === 'InProgress',
  );

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

  // Keep imageUrls and imageCaptions index-aligned. We only emit photos that
  // have a non-empty displayUrl so the lightbox never gets empty src strings.
  // displayUrl is a short-lived signed read URL — render-only, never persist
  // or echo it back. blobUrl (the permanent identity key) is never rendered.
  const { imageUrls, imageCaptions } = useMemo(() => {
    const urls: string[] = [];
    const captions: (string | null)[] = [];
    for (const p of photos) {
      if (!p.displayUrl) continue;
      urls.push(p.displayUrl);
      captions.push(p.description ?? null);
    }
    return { imageUrls: urls, imageCaptions: captions };
  }, [photos]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Category chips + diary CTA. Fixed height so the row never resizes
          when the CTA toggles in / out — `h-12` is enough headroom for any
          chip-button height regardless of glyph metrics. */}
      <div className="shrink-0 flex items-center gap-1 px-4 h-12 border-b border-border">
        {visibleCategories.map(({ key, labelKey }) => {
          const isActive = !isDiariesTab && activeCategory === key;
          const count = counts[key === null ? 'All' : key] ?? 0;
          return (
            <button
              key={String(key)}
              type="button"
              onClick={() => setActiveTab(key)}
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

        {/* Diaries chip — sibling to the photo categories. Clicking switches to
            the dedicated diary list. Pending diaries still appear as a sticky
            banner above the photo grid on every other tab. */}
        <button
          type="button"
          onClick={() => setActiveTab('Diaries')}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors border',
            isDiariesTab
              ? 'bg-accent text-bg border-accent'
              : 'bg-bg2 text-text3 border-border hover:bg-bg3 hover:text-text2',
          )}
        >
          <span>{t('diary.viewer.tabLabel')}</span>
          <span className={cn('tabular-nums', isDiariesTab ? 'opacity-90' : 'opacity-70')}>
            ({diariesCount})
          </span>
        </button>

        {/* Request photo diary CTA — only shown on the Diaries tab. The same
            action also lives in the plan-tab sidebar (under the Publish
            button), so the trainer always has a way to send a request. We
            reuse the shared `Button` component with `variant="default"` so
            this CTA matches the styling of the sidebar button on the plan
            tab — bordered, neutral background, gold accent on the emoji. */}
        {isDiariesTab && (
          <Button
            variant="default"
            onClick={() => setDiaryDialogOpen(true)}
            disabled={hasInFlightDiary}
            className="ml-auto"
            title={
              hasInFlightDiary
                ? t('diary.request.alreadyPending')
                : t('diary.request.photosTabCta')
            }
          >
            <span className="mr-1">📸</span>
            {t('diary.request.ctaButton')}
          </Button>
        )}
      </div>

      {/* Diaries tab — full list, takes the entire scroll area. */}
      {isDiariesTab && (
        <div className="flex-1 overflow-y-auto">
          <DiaryViewerPanel planId={planId} allPhotos={allPhotos} />
        </div>
      )}

      {/* Photo-category tabs — just the photo grid. Pending diary requests
          live exclusively on the Diaries tab now (their full list is sorted
          active-first), so the category tabs stay focused on the photos. */}
      {!isDiariesTab && (
        <>
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
                  {photo.displayUrl ? (
                    <img
                      src={photo.displayUrl}
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
        </>
      )}

      {/* Lightbox */}
      <ImageLightbox
        images={imageUrls}
        imageCaptions={imageCaptions}
        startIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={t('nutrition.photos.photoAlt')}
      />

      {/* Request photo diary dialog */}
      <RequestDiaryDialog
        open={diaryDialogOpen}
        onClose={() => setDiaryDialogOpen(false)}
        linkId={linkId}
        planId={planId}
        clientName={resolvedClientName}
        clientInitials={clientInitials}
      />
    </div>
  );
}
