import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { ClientPlanItem } from '@/api/client-plans';
import type { ClientPhotoResponse, MeasurementDto } from '@/api/generated';
import PhotoImage from '@/components/client-detail/photos/PhotoImage';
import {
  daysApart,
  findPhoto,
  formatDecimal,
  formatLongDate,
  photoPlanInfo,
  type PlanCapabilities,
} from '@/components/client-detail/photos/photosModel';
import { useNearestWeighIn } from '@/components/client-detail/photos/useClientPhotos';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
  /** The live photos from the query, newest first; selected photos are looked up here by id. */
  photos: ClientPhotoResponse[];
  initialIds: string[];
  plans: ClientPlanItem[] | undefined;
  capabilities: PlanCapabilities;
  locale: string;
  onExpired: () => void;
  onClose: () => void;
}

const MAX_SELECTED = 2;

function Badge({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-6 items-center justify-center rounded-full bg-training text-caption font-bold text-on-training',
        className,
      )}
    >
      {value}
    </span>
  );
}

interface SlotProps {
  photo: ClientPhotoResponse | undefined;
  measurement: MeasurementDto | undefined;
  badge: number;
  plans: ClientPlanItem[] | undefined;
  capabilities: PlanCapabilities;
  locale: string;
  onExpired: () => void;
}

/** One side of the comparison: the photo, its date and "weight · plan". */
function CompareSlot({ photo, measurement, badge, plans, capabilities, locale, onExpired }: SlotProps) {
  const { t } = useTranslation();

  if (!photo) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-sm items-center justify-center rounded-2xl border border-dashed border-border bg-sunken p-6 text-center text-body text-muted-foreground">
        {t('clientDetail.photos.compare.emptySlot')}
      </div>
    );
  }

  const date = formatLongDate(photo.takenAt, locale);
  const plan = photoPlanInfo(photo, plans, capabilities);
  const weight =
    measurement?.weightKg != null
      ? t('clientDetail.photos.weightValue', { value: formatDecimal(measurement.weightKg, locale) })
      : t('clientDetail.photos.compare.noWeighInShort');
  const planText = plan ? (plan.name ?? t('clientDetail.photos.planRemoved')) : t('clientDetail.photos.compare.noPlan');

  return (
    <figure className="flex w-full max-w-sm flex-col gap-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted">
        <PhotoImage
          key={photo.id}
          src={photo.displayUrl}
          alt={t('clientDetail.photos.photoAlt', { date })}
          onExpired={onExpired}
          className="size-full"
        />
        <Badge value={badge} className="absolute top-3 left-3" />
      </div>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-card-title font-bold text-ink">{date}</span>
        <span className="text-body text-muted-foreground">{`${weight} · ${planText}`}</span>
      </figcaption>
    </figure>
  );
}

function Delta({ value, label, unit, locale }: { value: number; label: string; unit: string; locale: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-stat font-bold', value < 0 ? 'text-success-ink' : 'text-ink')}>
        {`${formatDecimal(value, locale, true)} ${unit}`}
      </span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

/** Two photos side by side (older left) with days apart and the weight / body-fat change. */
export default function PhotoCompareDialog({
  clientId,
  photos,
  initialIds,
  plans,
  capabilities,
  locale,
  onExpired,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  // Selected ids that left the live data (range change, refetch) are ignored.
  const selected = selectedIds
    .map((id) => findPhoto(photos, id))
    .filter((photo): photo is ClientPhotoResponse => photo !== undefined)
    .sort((a, b) => new Date(a.takenAt ?? 0).getTime() - new Date(b.takenAt ?? 0).getTime());
  const older = selected[0];
  const newer = selected[1];

  const olderWeighIn = useNearestWeighIn(clientId, older?.takenAt).measurement;
  const newerWeighIn = useNearestWeighIn(clientId, newer?.takenAt).measurement;

  function toggle(id: string | undefined) {
    if (!id) {
      return;
    }
    setSelectedIds((current) => {
      const live = current.filter((candidate) => findPhoto(photos, candidate) !== undefined);
      if (live.includes(id)) {
        return live.filter((candidate) => candidate !== id);
      }
      return [...live, id].slice(-MAX_SELECTED);
    });
  }

  const days = daysApart(older?.takenAt, newer?.takenAt);
  const weightDelta =
    olderWeighIn?.weightKg != null && newerWeighIn?.weightKg != null
      ? newerWeighIn.weightKg - olderWeighIn.weightKg
      : undefined;
  const bodyFatDelta =
    olderWeighIn?.bodyFatPercentage != null && newerWeighIn?.bodyFatPercentage != null
      ? newerWeighIn.bodyFatPercentage - olderWeighIn.bodyFatPercentage
      : undefined;
  const bothSelected = older !== undefined && newer !== undefined;
  const missingWeighIn = bothSelected && weightDelta === undefined;

  const slotProps = { plans, capabilities, locale, onExpired };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-6xl flex-col gap-6 overflow-y-auto p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <DialogTitle className="text-card-title font-bold text-ink">
              {t('clientDetail.photos.compare.title')}
            </DialogTitle>
            <DialogDescription className="text-body">{t('clientDetail.photos.compare.subtitle')}</DialogDescription>
          </div>
          <DialogClose className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('common.close')}</span>
          </DialogClose>
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <CompareSlot photo={older} measurement={olderWeighIn} badge={1} {...slotProps} />
          <div className="flex min-w-32 flex-col items-center justify-center gap-5 self-center text-center">
            {bothSelected && days !== undefined && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-stat font-bold text-ink">{days}</span>
                <span className="text-caption text-muted-foreground">
                  {t('clientDetail.photos.compare.daysApart', { count: days })}
                </span>
              </div>
            )}
            {weightDelta !== undefined && (
              <Delta
                value={weightDelta}
                unit={t('clientDetail.photos.unit.kg')}
                label={t('clientDetail.photos.compare.weight')}
                locale={locale}
              />
            )}
            {bodyFatDelta !== undefined && (
              <Delta
                value={bodyFatDelta}
                unit={t('clientDetail.photos.unit.percent')}
                label={t('clientDetail.photos.compare.bodyFat')}
                locale={locale}
              />
            )}
            {missingWeighIn && (
              <p role="status" className="max-w-40 text-caption text-muted-foreground">
                {t('clientDetail.photos.compare.noWeighIn')}
              </p>
            )}
          </div>
          <CompareSlot photo={newer} measurement={newerWeighIn} badge={2} {...slotProps} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <span className="text-caption font-semibold text-muted-foreground">
            {t('clientDetail.photos.compare.strip', { count: photos.length })}
          </span>
          <ul className="flex gap-2 overflow-x-auto p-1">
            {photos.map((photo) => {
              const slot = selected.findIndex((candidate) => candidate.id === photo.id);
              const date = formatLongDate(photo.takenAt, locale);
              return (
                <li key={photo.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={slot >= 0}
                    aria-label={t('clientDetail.photos.compare.pick', { date })}
                    onClick={() => toggle(photo.id)}
                    className={cn(
                      'relative block h-24 w-18 overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      slot >= 0 && 'ring-2 ring-training',
                    )}
                  >
                    <PhotoImage
                      key={photo.id}
                      src={photo.displayUrl}
                      alt=""
                      onExpired={onExpired}
                      className="size-full"
                    />
                    {slot >= 0 && <Badge value={slot + 1} className="absolute top-1 left-1 size-5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
