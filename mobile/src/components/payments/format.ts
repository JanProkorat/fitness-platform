import type { TFunction } from 'i18next';

import { PackageBillingInterval, PaymentCurrency } from '@/api/generated';

const NBSP = ' ';
/** Intl may group with a narrow no-break space or a plain space; one visible separator keeps amounts uniform. */
const GROUP_SPACES = /[   ]/g;

/** Locale used to place separators; CZK amounts read the Czech way in every language. */
function numberLocale(currency: PaymentCurrency, language: string): string {
  if (currency === PaymentCurrency.CZK) return 'cs-CZ';
  if (language === 'de') return 'de-DE';
  if (language === 'cs') return 'cs-CZ';
  return 'en-US';
}

/**
 * "1 750 Kč" for CZK in every language; "75,50 €" for EUR in cs/de and "€75.50" in en.
 * Decimals appear only when the amount has cents.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: PaymentCurrency | null | undefined,
  language: string,
): string {
  if (amount == null) return '';
  const resolved = currency ?? PaymentCurrency.CZK;
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const digits = hasCents ? 2 : 0;
  const number = new Intl.NumberFormat(numberLocale(resolved, language), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(amount)
    .replace(GROUP_SPACES, NBSP);

  if (resolved === PaymentCurrency.CZK) return `${number}${NBSP}Kč`;
  return language === 'cs' || language === 'de' ? `${number}${NBSP}€` : `€${number}`;
}

/** An IBAN without spaces, as a bank app wants it pasted. */
export function compactIban(iban: string): string {
  return iban.replace(/\s+/g, '');
}

/** An IBAN in groups of four for reading ("CZ65 0800 0000 1920 0014 5399"). */
export function groupIban(iban: string): string {
  return compactIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

/** A calendar date from an ISO `yyyy-MM-dd` (or full ISO) string, read as local time so no timezone shifts the day. */
export function parseDay(iso: string | null | undefined): Date | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toLocaleUpperCase() ?? ''}${text.slice(1)}`;
}

/** Month name of a billing period ("November"); falls back to the payment name for a one-off payment. */
export function periodLabel(periodStart: string | null | undefined, name: string | null | undefined, language: string): string {
  const start = parseDay(periodStart);
  if (!start) return name ?? '';
  return capitalize(new Intl.DateTimeFormat(language, { month: 'long' }).format(start));
}

/** Short day and month ("1 Nov", "1. 11."), per the app language. */
export function shortDay(iso: string | null | undefined, language: string): string {
  const day = parseDay(iso);
  if (!day) return '';
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(day);
}

/** "Due 1 Nov · Friends & family" line under the amount; the discount label is omitted when there is none. */
export function dueLine(
  t: TFunction,
  dueDate: string | null | undefined,
  discountLabel: string | null | undefined,
  language: string,
): string {
  const due = t('payments.due', { date: shortDay(dueDate, language) });
  const discount = discountLabel?.trim();
  return discount ? `${due} · ${discount}` : due;
}

/** "Every month", "Every 5 weeks" or "One payment": the billing chip on a package. */
export function billingChip(
  t: TFunction,
  billing: PackageBillingInterval | null | undefined,
  intervalWeeks: number | null | undefined,
): string {
  if (billing === PackageBillingInterval.OneOff) return t('packages.chip.oneOff');
  if (billing === PackageBillingInterval.EveryNWeeks) {
    return t('packages.chip.everyNWeeks', { count: intervalWeeks ?? 1 });
  }
  return t('packages.chip.monthly');
}

/** "/ month", "/ 5 weeks" or "one-off": the unit that follows a package price. */
export function billingUnit(
  t: TFunction,
  billing: PackageBillingInterval | null | undefined,
  intervalWeeks: number | null | undefined,
): string {
  if (billing === PackageBillingInterval.OneOff) return t('packages.unit.oneOff');
  if (billing === PackageBillingInterval.EveryNWeeks) {
    return t('packages.unit.everyNWeeks', { count: intervalWeeks ?? 1 });
  }
  return t('packages.unit.monthly');
}
