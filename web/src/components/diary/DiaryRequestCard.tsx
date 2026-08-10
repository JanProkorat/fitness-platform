/**
 * DiaryRequestCard — shows one diary request's metadata, status chip,
 * and (for active/completed requests) photos grouped by calendar day.
 *
 * Photos are sourced from the parent's `allPhotos` prop (already loaded
 * by PlanPhotosTab) — filtered strictly by `diaryRequestId === request.id`
 * using the FK field now present on ClientPhotoResponse (ClientPhotos.Common).
 *
 * For Dismissed requests the dismiss reason is shown prominently instead.
 *
 * Design-of-record:
 *   docs/prototypes/trainer/scenes/nutrition-plan-detail.html (Photos tab)
 *   docs/prototypes/notion/scenes/nutrition.html (Foto-deník sidebar)
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DiaryRequestStatusChip } from './DiaryRequestStatusChip';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { PhotoDiaryRequestSummary } from '@/api/diary-requests';
import { PhotoDiaryStatus, PhotoDiaryMode } from '@/api/generated';
import type { ClientPhotoResponse } from '@/api/generated';
import { toLocalDateKey, calendarDayNumberFromKeys } from './diaryDayNumber';

interface Props {
  request: PhotoDiaryRequestSummary;
  /** All plan photos already loaded — this component filters by diaryRequestId FK. */
  allPhotos: ClientPhotoResponse[];
}

interface DayGroup {
  dateKey: string;
  /** Label like "Monday, 14 Apr" using the user's locale */
  label: string;
  dayNumber: number; // 1-based day number within diary period
  photos: ClientPhotoResponse[];
}

function buildDayGroups(
  photos: ClientPhotoResponse[],
  requestId: string,
  acceptedAt: string,
  durationDays: number,
): DayGroup[] {
  // Filter strictly by the FK field — no date-window heuristic needed.
  const diaryPhotos = photos.filter((p) => p.diaryRequestId === requestId);

  // Group by calendar day (takenAt preferred, uploadedAt as fallback)
  const grouped = new Map<string, ClientPhotoResponse[]>();
  for (const photo of diaryPhotos) {
    if (!photo.takenAt && !photo.uploadedAt) continue;
    const ts = photo.takenAt ?? photo.uploadedAt ?? '';
    const key = toLocalDateKey(ts);
    const arr = grouped.get(key) ?? [];
    arr.push(photo);
    grouped.set(key, arr);
  }

  // Convert to array and sort chronologically
  const acceptedDateKey = toLocalDateKey(acceptedAt);
  const days: DayGroup[] = [];
  for (const [dateKey, dayPhotos] of grouped) {
    const date = new Date(dateKey);
    days.push({
      dateKey,
      label: date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }),
      dayNumber: calendarDayNumberFromKeys(dateKey, acceptedDateKey, durationDays),
      photos: dayPhotos,
    });
  }
  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return days;
}

export function DiaryRequestCard({ request, allPhotos }: Props) {
  const { t } = useTranslation();
  const { status, acceptedAt, durationDays = 7, mode, dismissReason, createdAt } = request;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxDayPhotos, setLightboxDayPhotos] = useState<ClientPhotoResponse[]>([]);

  const dayGroups = useMemo(() => {
    if (
      status === PhotoDiaryStatus.InProgress ||
      status === PhotoDiaryStatus.Completed ||
      status === PhotoDiaryStatus.Accepted
    ) {
      if (!acceptedAt || !request.id) return [];
      return buildDayGroups(allPhotos, request.id, acceptedAt, durationDays);
    }
    return [];
  }, [status, acceptedAt, durationDays, allPhotos, request.id]);

  const totalPhotoCount = useMemo(
    () => dayGroups.reduce((sum, g) => sum + g.photos.length, 0),
    [dayGroups],
  );

  function openLightbox(dayPhotos: ClientPhotoResponse[], index: number) {
    setLightboxDayPhotos(dayPhotos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  // Keep URLs and captions index-aligned. Photos without a blobUrl are dropped
  // so the lightbox doesn't get empty src strings.
  const { lightboxUrls, lightboxCaptions } = useMemo(() => {
    const urls: string[] = [];
    const captions: (string | null)[] = [];
    for (const p of lightboxDayPhotos) {
      if (!p.blobUrl) continue;
      urls.push(p.blobUrl);
      captions.push(p.description ?? null);
    }
    return { lightboxUrls: urls, lightboxCaptions: captions };
  }, [lightboxDayPhotos]);

  const modeLabel =
    mode === PhotoDiaryMode.Bulk
      ? t('diary.viewer.modeBulk')
      : mode === PhotoDiaryMode.Workflow
        ? t('diary.viewer.modeWorkflow')
        : null;

  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const acceptedLabel = acceptedAt
    ? new Date(acceptedAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  // Colour the card border according to status. Pending / Accepted /
  // InProgress all share the gold "in-flight" treatment — the chip on
  // each of them is already gold; the surrounding card matches so the
  // whole active diary stands out, not just its status pill.
  const isInFlight =
    status === PhotoDiaryStatus.Pending ||
    status === PhotoDiaryStatus.Accepted ||
    status === PhotoDiaryStatus.InProgress;

  const cardBorderStyle: React.CSSProperties =
    status === PhotoDiaryStatus.Completed
      ? { border: '1px solid var(--status-completed-br)', background: 'var(--status-completed-bg)' }
      : status === PhotoDiaryStatus.Dismissed
        ? { border: '1px solid var(--status-dismissed-br)', background: 'var(--status-dismissed-bg)' }
        : isInFlight
          ? { border: '1px solid var(--status-inprogress-br)', background: 'var(--status-inprogress-bg)' }
          : { border: '1px solid var(--border)', background: 'var(--bg)' };

  return (
    <>
      <div
        className="rounded-md overflow-hidden"
        style={cardBorderStyle}
      >
        {/* Card header: status + meta */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <DiaryRequestStatusChip request={request} />
          {modeLabel && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              {modeLabel}
            </span>
          )}
          <span className="ml-auto text-[11px] text-text3 tabular-nums">
            {t('diary.viewer.durationDays', { count: durationDays })}
          </span>
        </div>

        {/* Meta row: created / accepted date */}
        {(createdLabel ?? acceptedLabel) && (
          <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-text3 border-b border-border">
            {createdLabel && (
              <span>
                {t('diary.viewer.requestedOn')}{' '}
                <span className="font-medium text-text2">{createdLabel}</span>
              </span>
            )}
            {acceptedLabel && (
              <span>
                {t('diary.viewer.acceptedOn')}{' '}
                <span className="font-medium text-text2">{acceptedLabel}</span>
              </span>
            )}
          </div>
        )}

        {/* Dismissed — show reason prominently */}
        {status === PhotoDiaryStatus.Dismissed && (
          <div className="px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text3 mb-1">
              {t('diary.viewer.dismissReasonLabel')}
            </div>
            <div
              className="text-[12px] rounded px-2.5 py-2"
              style={{
                color: 'var(--status-dismissed-text)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              {dismissReason ?? t('diary.viewer.dismissReasonEmpty')}
            </div>
          </div>
        )}

        {/* Photos section for Accepted / InProgress / Completed */}
        {(status === PhotoDiaryStatus.InProgress ||
          status === PhotoDiaryStatus.Completed ||
          status === PhotoDiaryStatus.Accepted) && (
          <div className="px-3 py-3">
            {dayGroups.length === 0 ? (
              <div className="text-[12px] text-text3 text-center py-4">
                {t('diary.viewer.noPhotosYet')}
              </div>
            ) : (
              <>
                {/* Summary line */}
                <div className="text-[11px] text-text3 mb-2 tabular-nums">
                  {t('diary.viewer.photoCount', { count: totalPhotoCount })}
                </div>
                {/* Day groups */}
                <div className="flex flex-col gap-3">
                  {dayGroups.map((group) => (
                    <div key={group.dateKey}>
                      {/* Day label */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                          style={{
                            width: 20,
                            height: 20,
                            background: 'var(--status-inprogress-bg)',
                            color: 'var(--status-inprogress-text)',
                            border: '1px solid var(--status-inprogress-br)',
                            flexShrink: 0,
                          }}
                        >
                          {group.dayNumber}
                        </span>
                        <span className="text-[11px] font-semibold text-text2">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-text3 ml-auto tabular-nums">
                          {t('diary.viewer.photoCount', { count: group.photos.length })}
                        </span>
                      </div>
                      {/* Thumbnail strip */}
                      <div className="flex flex-wrap gap-1.5">
                        {group.photos.map((photo, idx) => (
                          <button
                            key={photo.id ?? idx}
                            type="button"
                            onClick={() => openLightbox(group.photos, idx)}
                            className="relative overflow-hidden rounded transition-opacity hover:opacity-85 focus:outline-none"
                            style={{ width: 64, height: 64, background: 'var(--bg3)', flexShrink: 0 }}
                            title={photo.description ?? t('nutrition.photos.photoAlt')}
                          >
                            {photo.blobUrl ? (
                              <img
                                src={photo.blobUrl}
                                alt={photo.description ?? `${t('nutrition.photos.photoAlt')} ${idx + 1}`}
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-2xl opacity-30">
                                📷
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Pending — waiting message */}
        {status === PhotoDiaryStatus.Pending && (
          <div className="px-3 py-3 text-[12px] text-text3">
            {t('diary.viewer.pendingHint')}
          </div>
        )}
      </div>

      <ImageLightbox
        images={lightboxUrls}
        imageCaptions={lightboxCaptions}
        startIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        altPrefix={t('nutrition.photos.photoAlt')}
      />
    </>
  );
}
