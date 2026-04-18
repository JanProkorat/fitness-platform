/**
 * Formatting helpers for PersonalRecordsCard and PersonalRecordsSheet.
 *
 * Weight: locale-aware Intl.NumberFormat (cs-CZ → comma decimal, en/de → dot/comma).
 * Date: relative human-readable strings mirroring the prototype's _prFormatDate.
 */

// ─── Weight formatting ────────────────────────────────────────────────────────

/** Locale codes we recognise for weight number formatting. */
type SupportedLocale = 'cs' | 'en' | 'de' | string;

/**
 * Formats a weight value as a locale-aware string with up to two decimal places.
 *
 * Examples:
 *   formatWeight(82.5, 'cs') → "82,5 kg"
 *   formatWeight(82.5, 'en') → "82.5 kg"
 *   formatWeight(82.5, 'de') → "82,5 kg"
 *   formatWeight(100,  'cs') → "100 kg"
 */
export function formatWeight(weightKg: number, locale: SupportedLocale): string {
  const intlLocale = locale === 'cs' ? 'cs-CZ' : locale === 'de' ? 'de-DE' : 'en-US';
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(weightKg);
  return `${formatted} kg`;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative date string for a given ISO date string
 * and the current reference date (defaults to `new Date()`).
 *
 * Breakpoints mirror the prototype's `_prFormatDate`:
 *   0 days  → "dnes" / "today" / "heute"
 *   1 day   → "včera" / "yesterday" / "gestern"
 *   2–6 d   → "před N dny" / "N days ago" / "vor N Tagen"
 *   7–13 d  → "před týdnem" / "a week ago" / "vor einer Woche"
 *   14–20 d → "před 2 týdny" / "2 weeks ago" / "vor 2 Wochen"
 *   21–27 d → "před 3 týdny" / "3 weeks ago" / "vor 3 Wochen"
 *   ≥ 28 d  → "před N měs." / "N months ago" / "vor N Monaten"
 *
 * The `t` function follows the i18next signature; callers pass their own
 * `useTranslation().t`.
 */
export type TFunction = (key: string, options?: Record<string, unknown>) => string;

export function formatRecordDate(
  achievedAt: string,
  t: TFunction,
  now: Date = new Date(),
): string {
  const achieved = new Date(achievedAt);
  const diffMs = now.getTime() - achieved.getTime();
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysAgo <= 0) return t('profile.records.dateToday');
  if (daysAgo === 1) return t('profile.records.dateYesterday');
  if (daysAgo < 7) return t('profile.records.dateDaysAgo', { count: daysAgo });
  if (daysAgo < 14) return t('profile.records.dateWeekAgo');
  if (daysAgo < 21) return t('profile.records.dateWeeksAgo', { count: 2 });
  if (daysAgo < 28) return t('profile.records.dateWeeksAgo', { count: 3 });
  const months = Math.round(daysAgo / 30);
  return t('profile.records.dateMonthsAgo', { count: months });
}
