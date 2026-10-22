import type { CoachDiscountDto } from '@/api/coach-discounts';

export type CatalogStatus = 'active' | 'ended' | 'archived';

/** Formats a yyyy-MM-dd date (no time zone shift) for the UI language. */
export function formatDay(isoDate: string, language: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

/** A discount is Ended once its last day is before today, Archived once the coach archived it. */
export function discountStatus(item: CoachDiscountDto, today: string): CatalogStatus {
  if (item.archivedAt != null) {
    return 'archived';
  }
  return item.validTo != null && item.validTo.slice(0, 10) < today ? 'ended' : 'active';
}
