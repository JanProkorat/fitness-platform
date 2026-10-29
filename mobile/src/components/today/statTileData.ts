import type { CheckInHistoryItem } from '@/api/checkIns';
import type { MeasurementEntry } from '@/api/measurements';
import type { PhotoMonth } from '@/api/photos';
import { classify } from '@/components/checkIns/model';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const startOfDay = (time: number): number => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** Whole local calendar days from `from` to `to`; negative when `to` is earlier. */
const calendarDays = (from: number, to: number): number =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/**
 * The weight change in kg between the newest entry and the newest one taken a week or more before it.
 * Null when no entry that old exists, so the tile hides the line instead of guessing.
 * `entries` come newest first.
 */
export function weeklyWeightChange(entries: readonly MeasurementEntry[]): number | null {
  const weighed = entries.filter(
    (entry): entry is MeasurementEntry & { weightKg: number } =>
      entry.weightKg !== undefined && Number.isFinite(entry.weightKg),
  );
  const [latest] = weighed;
  if (!latest) return null;
  const baseline = weighed.find((entry) => entry.at <= latest.at - WEEK_MS);
  return baseline ? latest.weightKg - baseline.weightKg : null;
}

/** Whole days since the newest progress photo was taken; null when there is none with a date. */
export function daysSinceNewestPhoto(months: readonly PhotoMonth[], now: number): number | null {
  let newest = Number.NaN;
  for (const month of months) {
    for (const photo of month.photos) {
      const taken = photo.takenAt ? Date.parse(photo.takenAt) : Number.NaN;
      if (!Number.isNaN(taken) && !(taken <= newest)) newest = taken;
    }
  }
  return Number.isNaN(newest) ? null : Math.max(calendarDays(newest, now), 0);
}

export type OpenCheckIn = {
  /** The response deadline; absent for rows without one. */
  dueAt: string | undefined;
  /** Whole local days until the deadline, 0 when it is today. */
  daysLeft: number | null;
};

/** The open check-in due soonest, or null when none is open. */
export function openCheckIn(items: readonly CheckInHistoryItem[], now: number): OpenCheckIn | null {
  let best: OpenCheckIn | null = null;
  let bestDue = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (classify(item, now).kind !== 'open') continue;
    const due = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
    const sortKey = Number.isNaN(due) ? Number.POSITIVE_INFINITY : due;
    if (best === null || sortKey < bestDue) {
      best = {
        dueAt: item.dueAt,
        daysLeft: Number.isNaN(due) ? null : Math.max(calendarDays(now, due), 0),
      };
      bestDue = sortKey;
    }
  }
  return best;
}
