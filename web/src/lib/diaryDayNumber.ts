/**
 * Shared local-calendar-day helpers for the photo diary feature (#644).
 *
 * DiaryRequestCard groups photos by LOCAL calendar day; DiaryRequestStatusChip
 * used to compute "Day N" from a 24h rolling window off `acceptedAt`, which
 * disagreed with the card near local midnight. Both now go through this
 * single calendar-day computation so "Day N" always means the same thing
 * everywhere in the diary UI.
 */

/** Returns a local "YYYY-MM-DD" calendar-day key for a UTC timestamp string. */
export function toLocalDateKey(utcTimestamp: string): string {
  return new Date(utcTimestamp).toLocaleDateString('sv-SE'); // 'sv-SE' gives ISO format
}

/**
 * Computes the 1-based diary day number from two already-computed local
 * "YYYY-MM-DD" date keys, clamped to [1, durationDays].
 *
 * Both keys are parsed by `new Date()` as UTC midnight of that calendar
 * date — since the SAME parsing is applied to both sides, the resulting day
 * difference is an exact calendar-day count regardless of the caller's
 * timezone offset. Do not re-run `toLocalDateKey` on a value that is
 * already a date key — that would double-convert and can shift the day
 * near local midnight in negative-offset timezones.
 */
export function calendarDayNumberFromKeys(
  targetDateKey: string,
  acceptedDateKey: string,
  durationDays: number,
): number {
  const dayNumber =
    Math.floor(
      (new Date(targetDateKey).getTime() - new Date(acceptedDateKey).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;
  return Math.max(1, Math.min(dayNumber, durationDays));
}

/**
 * Convenience wrapper for the common case of two raw UTC timestamp strings
 * (e.g. "now" and `acceptedAt`) rather than pre-computed date keys.
 */
export function computeCalendarDayNumber(
  targetTimestamp: string,
  acceptedAt: string,
  durationDays: number,
): number {
  return calendarDayNumberFromKeys(
    toLocalDateKey(targetTimestamp),
    toLocalDateKey(acceptedAt),
    durationDays,
  );
}
