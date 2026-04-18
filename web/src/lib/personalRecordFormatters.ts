/**
 * Formatting helpers for personal-record timeline items.
 * No external dependencies — uses platform Intl APIs only.
 */

type SupportedLocale = 'cs' | 'en' | 'de';

/**
 * Formats a weight value as a locale-aware string with a "kg" suffix.
 *
 * Examples:
 *   formatWeight(82.5, 'cs') → "82,5 kg"
 *   formatWeight(82.5, 'en') → "82.5 kg"
 *   formatWeight(82.5, 'de') → "82,5 kg"
 *   formatWeight(undefined, 'en') → ""
 */
export function formatWeight(
  weightKg: number | undefined | null,
  locale: SupportedLocale,
): string {
  if (weightKg == null) return '';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(weightKg);
  return `${formatted} kg`;
}

/**
 * Formats an ISO date string as a locale-aware weekday + date string,
 * matching the idiom used in ClientDetailPage for other timeline dates.
 *
 * Examples (cs-CZ):  "čtvrtek 5. 3."
 * Examples (en-GB):  "Thursday, 5/3"
 */
export function formatTimelineDate(
  isoDate: string,
  locale: SupportedLocale,
): string {
  const bcp47: Record<SupportedLocale, string> = {
    cs: 'cs-CZ',
    en: 'en-GB',
    de: 'de-DE',
  };
  return new Date(isoDate).toLocaleDateString(bcp47[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  });
}
