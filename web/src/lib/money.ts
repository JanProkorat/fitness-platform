import { PaymentCurrency } from '@/api/generated';

const LOCALES: Record<string, string> = {
  cs: 'cs-CZ',
  de: 'de-DE',
  en: 'en-US',
};

/**
 * Formats an amount for display. CZK always uses Czech formatting ("1 750 Kč");
 * EUR follows the UI language ("75,50 €" for cs/de, "€75.50" for en).
 * Decimals appear only when the amount has cents. Unknown languages fall back to cs.
 */
export function formatMoney(amount: number, currency: PaymentCurrency, language: string): string {
  const locale =
    currency === PaymentCurrency.CZK ? LOCALES.cs : (LOCALES[language] ?? LOCALES.cs);
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** Parses a typed amount ("2 500", "75,50"); null when it is not a number with up to 2 decimals. */
export function parseAmount(raw: string): number | null {
  const normalised = raw.replace(/\s/g, '');
  if (!AMOUNT_PATTERN.test(normalised)) {
    return null;
  }
  return Number(normalised.replace(',', '.'));
}
