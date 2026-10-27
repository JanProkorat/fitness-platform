import type { TFunction } from 'i18next';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

/** "since Monday" within the last week, "since 3 Oct" for older links; empty when the date is unusable. */
export function sinceLabel(
  t: TFunction,
  language: string,
  iso: string | undefined,
  now: number = Date.now(),
): string {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return '';
  const date = new Date(then);
  const days = Math.floor((now - then) / DAY_MS);
  const when =
    days < WEEK_DAYS
      ? date.toLocaleDateString(language, { weekday: 'long' })
      : date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
  return t('today.progress.since', { when });
}
