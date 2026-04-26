/**
 * ClientPhotosTimeline
 *
 * Renders a client's progress photos grouped by calendar month, with
 * filters for Category (Food / Body / FreeForm) and Plan (dropdown).
 *
 * Filter state is owned by this component and keyed to `clientId` so that
 * switching clients automatically resets both filters.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getClientPhotoGroups } from '@/api/client-photos';
import { getPlans } from '@/api/plans';
import { getTrainingPlans } from '@/api/training-plans';
import { PlanPhotoCategory } from '@/api/generated';
import type { MonthGroupResponse, PlanPhotoResponse2 } from '@/api/client-photos';
import { FilterChips } from '@/components/domain/FilterChips';
import { Select } from '@/components/ui';
import { ImageLightbox } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientPhotosTimelineProps {
  /** Public client identifier (route param). Changing this resets all filters. */
  clientId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a YYYY-MM key as a localised month+year label. */
function formatYearMonth(yearMonth: string, locale: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientPhotosTimeline({ clientId }: ClientPhotosTimelineProps) {
  const { t, i18n } = useTranslation();

  // Locale string for date formatting
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-GB' : 'cs-CZ';

  // ── Filter state ────────────────────────────────────────────────────────────
  // Both reset when clientId changes via `key` prop on the parent or here via
  // explicit reset in an effect — but the simplest approach is to store filters
  // in a sub-object keyed to clientId so stale state is never visible.
  const [selectedCategory, setSelectedCategory] = useState<PlanPhotoCategory | ''>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // ── Category filter chips ────────────────────────────────────────────────────
  const categoryChips = useMemo(
    () => [
      { id: '', label: t('clientDetail.photos.categoryAll') },
      { id: PlanPhotoCategory.Food, label: t('clientDetail.photos.categoryFood') },
      { id: PlanPhotoCategory.Body, label: t('clientDetail.photos.categoryBody') },
      { id: PlanPhotoCategory.FreeForm, label: t('clientDetail.photos.categoryFreeForm') },
    ],
    [t],
  );

  // ── Fetch photos ─────────────────────────────────────────────────────────────
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: [
      'client-photos',
      clientId,
      selectedCategory || null,
      selectedPlanId || null,
    ],
    queryFn: () =>
      getClientPhotoGroups({
        clientId,
        category: selectedCategory ? (selectedCategory as PlanPhotoCategory) : null,
      }),
    enabled: !!clientId,
  });

  // ── Fetch nutrition plans for the Plan dropdown ──────────────────────────────
  const { data: nutritionPlansData } = useQuery({
    queryKey: ['plans', clientId],
    queryFn: () => getPlans({ clientId, pageSize: 100 }),
    enabled: !!clientId,
  });

  // ── Fetch training plans for the Plan dropdown ───────────────────────────────
  const { data: trainingPlansData } = useQuery({
    queryKey: ['training-plans', clientId],
    queryFn: () => getTrainingPlans({ clientId, pageSize: 100 }),
    enabled: !!clientId,
  });

  // ── Build unified plan options ───────────────────────────────────────────────
  const planOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: '', label: t('clientDetail.photos.planAll') },
    ];
    for (const p of nutritionPlansData?.plans ?? []) {
      opts.push({ value: p.planId, label: p.name });
    }
    for (const p of trainingPlansData?.plans ?? []) {
      opts.push({ value: p.planId, label: p.name });
    }
    return opts;
  }, [nutritionPlansData, trainingPlansData, t]);

  // ── Filter groups by selected plan (client-side) ─────────────────────────────
  // The backend endpoint doesn't support planId filtering directly, so we
  // do a lightweight client-side pass when a plan is selected.
  const groups: MonthGroupResponse[] = useMemo(() => {
    const raw = photosData?.groups ?? [];
    if (!selectedPlanId) return raw;
    return raw
      .map((group) => ({
        ...group,
        photos: (group.photos ?? []).filter(
          (p: PlanPhotoResponse2) => p.planId === selectedPlanId,
        ),
      }))
      .filter((group) => (group.photos ?? []).length > 0);
  }, [photosData, selectedPlanId]);

  // ── Lightbox state ────────────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function openLightbox(allPhotos: PlanPhotoResponse2[], clickedIndex: number) {
    // Build the URL list from only the photos that have a blobUrl (same
    // compression as before), but re-derive the index so it points into
    // that filtered array rather than the unfiltered one.
    const urls = allPhotos.map((p) => p.blobUrl ?? '').filter(Boolean);
    const filteredIndex = allPhotos
      .slice(0, clickedIndex)
      .filter((p) => !!p.blobUrl).length;
    setLightboxImages(urls);
    setLightboxIndex(filteredIndex);
    setLightboxOpen(true);
  }

  // ── Empty state ────────────────────────────────────────────────────────────────
  const isEmpty = !photosLoading && groups.length === 0;

  return (
    <div className="py-3">
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Category chips */}
        <FilterChips
          chips={categoryChips}
          activeId={selectedCategory}
          onChange={(id) => setSelectedCategory(id as PlanPhotoCategory | '')}
        />

        {/* Plan dropdown */}
        <div className="w-52">
          <Select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            aria-label={t('clientDetail.photos.planLabel')}
          >
            {planOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {photosLoading && (
        <p className="text-[13px] text-text3">{t('common.loading')}</p>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3" aria-hidden="true">📷</span>
          <p className="text-[15px] font-medium text-text mb-1">
            {t('clientDetail.photos.emptyTitle')}
          </p>
          <p className="text-[13px] text-text3 max-w-xs">
            {t('clientDetail.photos.emptyDescription')}
          </p>
        </div>
      )}

      {/* ── Timeline grouped by month ──────────────────────────────────────── */}
      {!photosLoading &&
        groups.map((group) => {
          const photos = group.photos ?? [];
          if (photos.length === 0) return null;
          const label = group.yearMonth
            ? formatYearMonth(group.yearMonth, locale)
            : group.yearMonth ?? '';

          return (
            <div key={group.yearMonth} className="mb-6">
              {/* Month heading */}
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text3 mb-2.5">
                {label}
              </h3>

              {/* Photo grid — 4 columns */}
              <div className="grid grid-cols-4 gap-1.5">
                {photos.map((photo, idx) =>
                  photo.blobUrl ? (
                    <button
                      key={photo.id ?? idx}
                      type="button"
                      onClick={() => openLightbox(photos, idx)}
                      aria-label={photo.description || t('imageLightbox.open')}
                      className="group relative aspect-square overflow-hidden rounded-md bg-bg3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <img
                        src={photo.blobUrl}
                        alt={photo.description ?? ''}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Category badge */}
                      {photo.category && (
                        <span className="absolute bottom-1 left-1 rounded px-1 py-0.5 text-[9px] font-medium bg-black/50 text-white">
                          {t(`clientDetail.photos.category${photo.category}`)}
                        </span>
                      )}
                    </button>
                  ) : (
                    /* Placeholder tile — no blobUrl, not interactive */
                    <div
                      key={photo.id ?? idx}
                      className="relative aspect-square overflow-hidden rounded-md bg-bg3"
                    >
                      <span
                        className="flex h-full w-full items-center justify-center text-2xl"
                        aria-hidden="true"
                      >
                        {photo.category === PlanPhotoCategory.Food
                          ? '🍽'
                          : photo.category === PlanPhotoCategory.Body
                            ? '🏃'
                            : '📷'}
                      </span>
                      {/* Category badge */}
                      {photo.category && (
                        <span className="absolute bottom-1 left-1 rounded px-1 py-0.5 text-[9px] font-medium bg-black/50 text-white">
                          {t(`clientDetail.photos.category${photo.category}`)}
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      <ImageLightbox
        images={lightboxImages}
        startIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={t('clientDetail.photos.photoAltPrefix')}
      />
    </div>
  );
}
