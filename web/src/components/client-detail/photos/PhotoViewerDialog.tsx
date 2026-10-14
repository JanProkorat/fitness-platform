import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Columns2, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { ClientPlanItem } from '@/api/client-plans';
import type { ClientPhotoResponse } from '@/api/generated';
import PhotoImage from '@/components/client-detail/photos/PhotoImage';
import { PlanKindIcon } from '@/components/client-detail/photos/PlanChip';
import {
  findPhoto,
  formatDecimal,
  formatLongDate,
  formatMeasuredDate,
  formatTime,
  photoPlanInfo,
  type PhotoPlanInfo,
  type PlanCapabilities,
} from '@/components/client-detail/photos/photosModel';
import { useNearestWeighIn } from '@/components/client-detail/photos/useClientPhotos';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
  /** The live photos from the query, newest first; the viewer looks its photo up here by id. */
  photos: ClientPhotoResponse[];
  photoId: string;
  plans: ClientPlanItem[] | undefined;
  capabilities: PlanCapabilities;
  locale: string;
  onNavigate: (photoId: string) => void;
  onCompare: (photoId: string) => void;
  onExpired: () => void;
  onClose: () => void;
}

const ROUND_BUTTON_CLASS =
  'absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-popover outline-none transition-opacity hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40';

function planSubtitle(plan: PhotoPlanInfo, t: (key: string, options?: Record<string, unknown>) => string): string {
  const type = t(`clientDetail.photos.planType.${plan.kind}`);
  if (plan.week === undefined) {
    return type;
  }
  return plan.totalWeeks === undefined
    ? t('clientDetail.photos.viewer.planWeek', { type, week: plan.week })
    : t('clientDetail.photos.viewer.planWeekOf', { type, week: plan.week, total: plan.totalWeeks });
}

/** Large-photo viewer with prev/next, caption, plan and the closest weigh-in. */
export default function PhotoViewerDialog({
  clientId,
  photos,
  photoId,
  plans,
  capabilities,
  locale,
  onNavigate,
  onCompare,
  onExpired,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const photo = findPhoto(photos, photoId);
  const index = photos.findIndex((candidate) => candidate.id === photoId);
  const { measurement, isPending: weighInPending } = useNearestWeighIn(clientId, photo?.takenAt);

  // The photo can leave the live data (range change, refetch); nothing left to show then.
  useEffect(() => {
    if (!photo) {
      onClose();
    }
  }, [photo, onClose]);

  if (!photo) {
    return null;
  }

  const plan = photoPlanInfo(photo, plans, capabilities);
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index < photos.length - 1 ? photos[index + 1] : undefined;
  const showOpenPlan = plan !== undefined && plan.name !== null && plan.kind === 'nutrition' && capabilities.nutrition;
  const date = formatLongDate(photo.takenAt, locale);

  function go(target: ClientPhotoResponse | undefined) {
    if (target?.id) {
      onNavigate(target.id);
    }
  }

  const weighInParts: string[] = [];
  if (measurement?.bodyFatPercentage != null) {
    weighInParts.push(
      t('clientDetail.photos.viewer.bodyFat', { value: formatDecimal(measurement.bodyFatPercentage, locale) }),
    );
  }
  if (measurement) {
    weighInParts.push(
      t('clientDetail.photos.viewer.measured', { date: formatMeasuredDate(measurement.measuredAt, locale) }),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="grid max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-5xl grid-cols-1 gap-0 overflow-y-auto p-0 md:grid-cols-[1.1fr_1fr]"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            go(previous);
          } else if (event.key === 'ArrowRight') {
            go(next);
          }
        }}
      >
        <div className="relative flex min-h-96 flex-col items-center justify-center gap-4 bg-sunken px-16 py-8">
          <PhotoImage
            key={photo.id}
            src={photo.displayUrl}
            alt={t('clientDetail.photos.photoAlt', { date })}
            onExpired={onExpired}
            fit="contain"
            className="max-h-[60dvh] w-full rounded-xl"
          />
          <button
            type="button"
            className={cn(ROUND_BUTTON_CLASS, 'left-4')}
            disabled={!previous}
            onClick={() => go(previous)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('clientDetail.photos.viewer.previous')}</span>
          </button>
          <button
            type="button"
            className={cn(ROUND_BUTTON_CLASS, 'right-4')}
            disabled={!next}
            onClick={() => go(next)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('clientDetail.photos.viewer.next')}</span>
          </button>
          <span className="text-caption font-semibold text-muted-foreground">
            {t('clientDetail.photos.viewer.position', { index: index + 1, total: photos.length })}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-5 p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-card-title font-bold text-ink">{date}</DialogTitle>
              <DialogDescription className="text-body">
                {t('clientDetail.photos.viewer.uploadedAt', { time: formatTime(photo.uploadedAt, locale) })}
              </DialogDescription>
            </div>
            <DialogClose className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">{t('common.close')}</span>
            </DialogClose>
          </div>

          {photo.description && (
            <section className="flex flex-col gap-1.5">
              <h4 className="text-tick font-semibold tracking-wider text-muted-foreground uppercase">
                {t('clientDetail.photos.viewer.caption')}
              </h4>
              <p className="text-copy text-ink">{photo.description}</p>
            </section>
          )}

          {plan && (
            <section className="flex flex-col gap-1.5">
              <h4 className="text-tick font-semibold tracking-wider text-muted-foreground uppercase">
                {t('clientDetail.photos.viewer.takenDuring')}
              </h4>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    plan.name === null
                      ? 'bg-muted text-muted-foreground'
                      : plan.kind === 'training'
                        ? 'bg-training-soft text-training-ink'
                        : 'bg-nutrition-soft text-nutrition-ink',
                  )}
                >
                  <PlanKindIcon kind={plan.kind} className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-copy font-bold text-ink">
                    {plan.name ?? t('clientDetail.photos.planRemoved')}
                  </span>
                  <span className="text-caption text-muted-foreground">{planSubtitle(plan, t)}</span>
                </div>
                {showOpenPlan && (
                  <Button asChild variant="outline" size="lg">
                    <Link to={`/clients/${clientId}/nutrition`}>
                      {t('clientDetail.photos.viewer.openPlan')}
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <h4 className="text-tick font-semibold tracking-wider text-muted-foreground uppercase">
              {t('clientDetail.photos.viewer.closestWeighIn')}
            </h4>
            {measurement?.weightKg != null ? (
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border">
                  <TrendingUp className="size-4" aria-hidden="true" />
                </span>
                <p className="text-body text-muted-foreground">
                  <strong className="font-bold text-ink">
                    {t('clientDetail.photos.weightValue', { value: formatDecimal(measurement.weightKg, locale) })}
                  </strong>
                  {weighInParts.map((part) => ` · ${part}`).join('')}
                </p>
              </div>
            ) : (
              !weighInPending && <p className="text-body text-muted-foreground">{t('clientDetail.photos.noWeighIn')}</p>
            )}
          </section>

          <div className="mt-auto pt-4">
            <Button type="button" size="lg" onClick={() => photo.id && onCompare(photo.id)} disabled={photos.length < 2}>
              <Columns2 aria-hidden="true" />
              {t('clientDetail.photos.viewer.compareWith')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
