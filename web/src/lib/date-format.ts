/**
 * Shared date-formatting helpers for the client-detail tabs/cards. Before
 * this extraction, ~8 files under components/clients/** each hand-rolled a
 * near-identical `formatDate(iso, locale)` wrapper around
 * `Date#toLocaleDateString` with only the empty-value fallback and the
 * day/month/year style differing (#687).
 */

export type ClientDateStyle = 'numeric' | 'short';

const STYLE_OPTIONS: Record<ClientDateStyle, Intl.DateTimeFormatOptions> = {
  // e.g. "5.6.2026"
  numeric: { day: 'numeric', month: 'numeric', year: 'numeric' },
  // e.g. "5 Jun 2026"
  short: { day: 'numeric', month: 'short', year: 'numeric' },
};

/**
 * Formats an ISO date string using the active locale.
 *
 * @param iso ISO date string, or null/undefined for a missing value.
 * @param locale Active i18n locale (`i18n.language` or the `useTranslation()` value).
 * @param style `'numeric'` (d.m.yyyy, the default) or `'short'` (d MMM yyyy).
 * @param emptyFallback String returned when `iso` is null/undefined/empty.
 *   Call sites disagreed on this before extraction (some used `''`, some
 *   `'—'`) — defaults to `''` to match the majority of call sites.
 */
export function formatClientDate(
  iso: string | null | undefined,
  locale: string,
  style: ClientDateStyle = 'numeric',
  emptyFallback = '',
): string {
  if (!iso) return emptyFallback;
  try {
    return new Date(iso).toLocaleDateString(locale, STYLE_OPTIONS[style]);
  } catch {
    return iso;
  }
}

/** Formats an ISO date string as a localised date + time (`'short'` style + HH:mm). */
export function formatClientDateTime(
  iso: string | null | undefined,
  locale: string,
  emptyFallback = '',
): string {
  if (!iso) return emptyFallback;
  try {
    return new Date(iso).toLocaleDateString(locale, {
      ...STYLE_OPTIONS.short,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Formats a start/end ISO pair as a "d.m.yyyy – d.m.yyyy" range (open-ended on either side). */
export function formatClientDatePeriod(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  locale: string,
): string {
  const start = formatClientDate(periodStart, locale);
  const end = formatClientDate(periodEnd, locale);
  if (!start && !end) return '—';
  if (start && !end) return `${start} →`;
  if (!start && end) return `→ ${end}`;
  return `${start} – ${end}`;
}
