import { api } from '@/api/client';
import { PlanPhotoCategory } from '@/api/generated';
import { MEASUREMENTS_QUERY_KEY } from '@/api/measurements';

/** Nested under the measurements key so a new measurement refreshes the journey chart too. */
export const JOURNEY_SERIES_QUERY_KEY = [...MEASUREMENTS_QUERY_KEY, 'journey-series'] as const;
export const JOURNEY_PHOTOS_QUERY_KEY = ['journey', 'photo-dates'] as const;

/** Both endpoints cap a page at 100 rows. */
const PAGE_SIZE = 100;
/** Safety stop so a misbehaving server cannot keep the loop paging forever. */
const MAX_PAGES = 50;

export type JourneyPoint = { at: number; weightKg?: number; waistCm?: number };

const finite = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isFinite(value) ? value : undefined;

/** Every measurement, oldest first, paged through `totalCount` (the endpoint is newest first). */
export async function fetchJourneySeries(signal?: AbortSignal): Promise<JourneyPoint[]> {
  const points: JourneyPoint[] = [];
  let seen = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await api.getMeasurementsEndpoint(page, PAGE_SIZE, undefined, undefined, signal);
    const items = response.items ?? [];
    seen += items.length;
    for (const item of items) {
      const at = item.measuredAt ? Date.parse(item.measuredAt) : Number.NaN;
      if (Number.isNaN(at)) continue;
      const weightKg = finite(item.weightKg);
      const waistCm = finite(item.waistCm);
      if (weightKg !== undefined || waistCm !== undefined) points.push({ at, weightKg, waistCm });
    }
    const total = response.totalCount ?? 0;
    if (items.length < PAGE_SIZE || seen >= total) break;
  }
  return points.sort((a, b) => a.at - b.at);
}

/** When the client took each body or free-form progress photo, oldest first; the chart only needs the dates. */
export async function fetchJourneyPhotoDates(signal?: AbortSignal): Promise<number[]> {
  const dates: number[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // The endpoint reports no total, so a short page means the last one.
    const response = await api.getMyPhotosEndpoint(page, PAGE_SIZE, false, undefined, undefined, undefined, signal);
    const photos = response.photos ?? [];
    for (const photo of photos) {
      const at = photo.takenAt ? Date.parse(photo.takenAt) : Number.NaN;
      const progress =
        photo.category === PlanPhotoCategory.Body || photo.category === PlanPhotoCategory.FreeForm;
      if (progress && !Number.isNaN(at)) dates.push(at);
    }
    if (photos.length < PAGE_SIZE) break;
  }
  return dates.sort((a, b) => a - b);
}
