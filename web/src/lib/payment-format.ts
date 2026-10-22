import { formatMoney } from '@/lib/money';
import { PaymentCurrency } from '@/api/generated';

const DAY_MS = 24 * 60 * 60 * 1000;

/** English dates read day-first, as on the boards ("1 Nov"), so "en" formats as en-GB. */
function dateLocale(language: string): string {
  return language === 'en' ? 'en-GB' : language;
}

/** The money amount of a payment, or an em dash when the server sent none. */
export function formatPaymentAmount(
  amount: number | undefined,
  currency: PaymentCurrency | undefined,
  language: string,
): string {
  if (amount === undefined || currency === undefined) {
    return '—';
  }
  return formatMoney(amount, currency, language);
}

/** Today as a local `yyyy-mm-dd` string, the value shape of a date input. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Adds whole days to a `yyyy-mm-dd` string. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Parses the `yyyy-mm-dd` part of an ISO string as a local calendar date. */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Whole days from one calendar date to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** "1 Nov", or "1 Nov 2027" when the date is not in the current year. */
export function formatShortDay(iso: string | undefined, language: string): string {
  if (!iso) {
    return '—';
  }
  const date = parseIsoDate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(dateLocale(language), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "25 Oct" for a UTC timestamp, in the viewer's time zone. */
export function formatInstantDay(instant: string | undefined, language: string): string {
  if (!instant) {
    return '—';
  }
  return new Date(instant).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short' });
}

/** "31 Oct 2026". */
export function formatFullDay(iso: string | undefined, language: string): string {
  if (!iso) {
    return '—';
  }
  return parseIsoDate(iso).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "November 2026". */
export function formatMonthYear(iso: string, language: string): string {
  return parseIsoDate(iso).toLocaleDateString(dateLocale(language), { month: 'long', year: 'numeric' });
}

/** "November". */
export function formatMonthName(iso: string, language: string): string {
  return parseIsoDate(iso).toLocaleDateString(dateLocale(language), { month: 'long' });
}

/** "2026-11" history period to "November 2026"; anything else (a one-off title) is returned as is. */
export function formatHistoryPeriod(period: string | undefined, language: string): string {
  if (!period) {
    return '';
  }
  return /^\d{4}-\d{2}$/.test(period) ? formatMonthYear(`${period}-01`, language) : period;
}

/** The label of a billing period: a calendar month when it covers one, otherwise a date range. */
export function formatPeriodLabel(
  periodStart: string | undefined,
  periodEnd: string | undefined,
  language: string,
): string {
  if (!periodStart) {
    return '';
  }
  const start = parseIsoDate(periodStart);
  const end = periodEnd ? parseIsoDate(periodEnd) : null;
  const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const coversMonth =
    start.getDate() === 1 && (end === null || toIsoDate(end) === toIsoDate(lastOfMonth));
  if (coversMonth) {
    return formatMonthYear(periodStart, language);
  }
  const startLabel = formatShortDay(periodStart, language);
  return periodEnd ? `${startLabel} – ${formatShortDay(periodEnd, language)}` : startLabel;
}

/** An IBAN in groups of four characters, for display. */
export function groupIban(iban: string | undefined): string {
  if (!iban) {
    return '';
  }
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
