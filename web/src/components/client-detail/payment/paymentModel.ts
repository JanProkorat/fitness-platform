import type { TFunction } from 'i18next';
import {
  ClientPaymentStatus,
  DiscountScope,
  DiscountType,
  PackageBillingInterval,
  type ClientPaymentRowDto,
  type ClientPaymentSummaryTermsDto,
  type CoachDiscountDto,
  type CoachPackageDto,
  type PaymentCurrency,
} from '@/api/client-payments';
import { formatMoney } from '@/lib/money';

/** "/ month", "/ 2 weeks" or "one-off": what follows a package price. */
export function billingSuffix(
  t: TFunction,
  billing: PackageBillingInterval | undefined,
  intervalWeeks: number | undefined,
): string {
  switch (billing) {
    case PackageBillingInterval.EveryNWeeks:
      return t('payments.client.billing.everyWeeks', { count: intervalWeeks ?? 1 });
    case PackageBillingInterval.OneOff:
      return t('payments.client.billing.oneOff');
    default:
      return t('payments.client.billing.monthly');
  }
}

/** "−30 %" for a percentage, "−750 Kč" for a fixed amount. */
export function discountValueLabel(
  type: DiscountType | undefined,
  value: number | undefined,
  currency: PaymentCurrency | undefined,
  language: string,
): string {
  if (value == null) {
    return '';
  }
  if (type === DiscountType.FixedAmount && currency != null) {
    return `−${formatMoney(value, currency, language)}`;
  }
  return `−${value} %`;
}

/** Statuses a payment can still be settled from. */
export function isOpenPayment(row: ClientPaymentRowDto): boolean {
  return (
    row.status === ClientPaymentStatus.Upcoming ||
    row.status === ClientPaymentStatus.Requested ||
    row.status === ClientPaymentStatus.Overdue
  );
}

/** Rows the coach can ask the client to pay: every open one. */
export function requestablePayments(rows: readonly ClientPaymentRowDto[]): ClientPaymentRowDto[] {
  return rows.filter(isOpenPayment).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

/** What a discount takes off a package price, as the server would compute it. */
export function previewDiscountAmount(
  discount: CoachDiscountDto | undefined,
  basePrice: number,
): number {
  if (!discount || discount.value == null) {
    return 0;
  }
  if (discount.type === DiscountType.FixedAmount) {
    return Math.min(discount.value, basePrice);
  }
  return Math.round(basePrice * discount.value) / 100;
}

/** Whether a discount can be combined with a package (scope and currency). */
export function discountFitsPackage(discount: CoachDiscountDto, pkg: CoachPackageDto | undefined): boolean {
  if (!pkg) {
    return false;
  }
  if (discount.type === DiscountType.FixedAmount && discount.currency !== pkg.currency) {
    return false;
  }
  switch (discount.scope) {
    case DiscountScope.SelectedPackages:
      return (discount.packageIds ?? []).includes(pkg.packageId ?? '');
    case DiscountScope.MonthlyPackages:
      return pkg.billing === PackageBillingInterval.Monthly;
    default:
      return true;
  }
}

/** The terms in force as a one-line summary: "2 500 Kč / month · Friends & family −30 %". */
export function termsSummary(
  t: TFunction,
  terms: ClientPaymentSummaryTermsDto,
  language: string,
): string {
  const currency = terms.currency;
  const basePrice =
    terms.packagePrice != null && currency != null
      ? `${formatMoney(terms.packagePrice, currency, language)} ${billingSuffix(t, terms.billing, terms.intervalWeeks)}`
      : '';
  const extra =
    terms.customPrice != null && currency != null
      ? t('payments.client.summary.customPrice', { price: formatMoney(terms.customPrice, currency, language) })
      : terms.discountName
        ? `${terms.discountName} ${discountValueLabel(terms.discountType, terms.discountValue, currency, language)}`
        : '';
  return [basePrice, extra].filter(Boolean).join(' · ');
}
