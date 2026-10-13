import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientFoodPhotos } from '@/api/photos';
import {
  getCheckInDetail,
  getClientCheckInHistory,
  getTrainerCheckIns,
} from '@/api/weekly-checkins';
import type { ClientPhotoResponse } from '@/api/generated';
import {
  currentWeekRange,
  formatCheckInDate,
  formatLocalWeekday,
  latestAnsweredWeek,
  photoMealGroup,
  pickAnsweredCheckIn,
} from '@/components/client-detail/nutrition/mealPhotosNotes';

const MAX_PHOTOS = 6;
const HISTORY_WEEKS = 8;

interface Props {
  /** ClientProfile.PublicId, the id of the client detail route. */
  clientId: string;
  /** ApplicationUser.Id, the id the weekly check-in endpoints use. */
  clientUserId: string | undefined;
}

function PhotoTile({ photo, caption }: { photo: ClientPhotoResponse; caption: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  return (
    <li data-testid="meal-photo" className="relative h-16 overflow-hidden rounded-lg bg-muted">
      {failed || !photo.displayUrl ? (
        <div
          data-testid="meal-photo-unavailable"
          role="img"
          aria-label={t('clientDetail.nutrition.photos.imageUnavailable')}
          className="flex size-full items-center justify-center text-muted-foreground"
        >
          <ImageOff className="size-5" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={photo.displayUrl}
          alt={t('clientDetail.nutrition.photos.photoAlt', { caption })}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
      <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-sm bg-scrim/60 px-1.5 py-0.5 text-meta text-on-dark">
        {caption}
      </span>
    </li>
  );
}

/** "Meal photos and notes" card of the Nutrition tab: this week's food photos and the latest check-in note. */
export default function MealPhotosNotesCard({ clientId, clientUserId }: Props) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const locale = i18n.language;
  const { from, to } = currentWeekRange();

  const photosQuery = useQuery({
    queryKey: ['client-food-photos', clientId, from],
    queryFn: () => getClientFoodPhotos(clientId, from, to, MAX_PHOTOS),
    enabled: Boolean(clientId),
  });

  const historyQuery = useQuery({
    queryKey: ['client-checkin-history', clientUserId, HISTORY_WEEKS],
    queryFn: () => getClientCheckInHistory(clientUserId ?? '', HISTORY_WEEKS),
    enabled: Boolean(clientUserId),
  });
  const answeredWeek = useMemo(() => latestAnsweredWeek(historyQuery.data?.weeks), [historyQuery.data]);
  const weekStartDate = answeredWeek?.weekStartDate?.slice(0, 10);

  const listQuery = useQuery({
    queryKey: ['trainer-check-ins', weekStartDate],
    queryFn: () => getTrainerCheckIns(weekStartDate),
    enabled: Boolean(weekStartDate),
  });
  const checkIn = useMemo(
    () => (clientUserId ? pickAnsweredCheckIn(listQuery.data?.checkIns ?? [], clientUserId) : undefined),
    [listQuery.data, clientUserId],
  );

  const detailQuery = useQuery({
    queryKey: ['check-in-detail', checkIn?.id],
    queryFn: () => getCheckInDetail(checkIn?.id ?? ''),
    enabled: Boolean(checkIn?.id),
  });

  const noteFailed = historyQuery.isError || listQuery.isError || detailQuery.isError;
  const retryNote = () => {
    for (const query of [historyQuery, listQuery, detailQuery]) {
      if (query.isError) {
        void query.refetch();
      }
    }
  };

  const noteLoading =
    !noteFailed &&
    Boolean(clientUserId) &&
    (historyQuery.isPending || (Boolean(weekStartDate) && listQuery.isPending) || (Boolean(checkIn) && detailQuery.isPending));
  const noCheckIn = !noteFailed && !noteLoading && (!clientUserId || !answeredWeek || !checkIn);

  const captionOf = (photo: ClientPhotoResponse): string => {
    const day = formatLocalWeekday(photo.takenAt, locale);
    const group = photoMealGroup(photo.mealKind);
    const meal = group ? t(`clientDetail.nutrition.thisWeek.group.${group}`) : undefined;
    if (meal && day) {
      return t('clientDetail.nutrition.photos.caption', { meal, day });
    }
    return meal ?? day ?? '';
  };

  const detail = detailQuery.data;
  const date = formatCheckInDate(detail?.respondedAt ?? detail?.sentAt, locale);
  const hunger = detail?.hungerScore;

  const photos = photosQuery.data ?? [];

  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-card-title font-bold text-ink">
          {t('clientDetail.nutrition.photos.heading')}
        </h2>
        <span className="text-body text-muted-foreground">{t('clientDetail.nutrition.photos.hint')}</span>
      </div>

      {photosQuery.isPending && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {photosQuery.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-caption text-muted-foreground">{t('clientDetail.nutrition.photos.error')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void photosQuery.refetch()}>
            {t('clients.retry')}
          </Button>
        </div>
      )}

      {!photosQuery.isPending && !photosQuery.isError && photos.length === 0 && (
        <p role="status" className="text-body text-muted-foreground">
          {t('clientDetail.nutrition.photos.empty')}
        </p>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.slice(0, MAX_PHOTOS).map((photo, index) => (
            <PhotoTile
              key={`${photo.id ?? index}-${photo.displayUrl ?? ''}`}
              photo={photo}
              caption={captionOf(photo)}
            />
          ))}
        </ul>
      )}

      <div data-testid="check-in-note" className="mt-auto flex flex-col gap-2 rounded-xl border border-border p-3">
        {noteLoading && <Skeleton className="h-12 w-full" />}

        {noteFailed && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-caption text-muted-foreground">{t('clientDetail.nutrition.notes.error')}</p>
            <Button type="button" variant="outline" size="sm" onClick={retryNote}>
              {t('clients.retry')}
            </Button>
          </div>
        )}

        {noCheckIn && (
          <p role="status" className="text-body text-muted-foreground">
            {t('clientDetail.nutrition.notes.noCheckIn')}
          </p>
        )}

        {detail && !noteFailed && !noteLoading && (
          <>
            {detail.note ? (
              <blockquote className="text-copy text-ink">
                {t('clientDetail.nutrition.notes.quote', { note: detail.note })}
              </blockquote>
            ) : (
              <p className="text-body text-muted-foreground">{t('clientDetail.nutrition.notes.noNote')}</p>
            )}
            <p data-testid="check-in-meta" className="text-meta text-muted-foreground">
              {hunger != null
                ? t('clientDetail.nutrition.notes.meta', { date: date ?? '', score: hunger })
                : t('clientDetail.nutrition.notes.metaNoHunger', { date: date ?? '' })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
