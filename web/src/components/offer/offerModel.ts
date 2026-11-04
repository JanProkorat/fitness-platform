import type { TFunction } from 'i18next';
import {
  DiscountDuration,
  PackageBillingInterval,
  PaymentCurrency,
  type CoachDiscountDto,
  type CoachPackageDto,
} from '@/api/client-payments';
import {
  discountMismatch,
  previewDiscountAmount,
  type DiscountMismatch,
} from '@/components/client-detail/payment/paymentModel';

/** A package as the "Your offer" pieces show it, whether it comes from the coach's list or from a request. */
export interface OfferPackage {
  id: string;
  name: string;
  price: number;
  currency: PaymentCurrency;
  billing: PackageBillingInterval;
  intervalWeeks?: number;
}

/** Any package DTO with the shared display fields (coach list, incoming request, pending row). */
interface PackageSource {
  publicId?: string;
  packageId?: string;
  name?: string;
  price?: number;
  currency?: PaymentCurrency;
  billing?: PackageBillingInterval;
  intervalWeeks?: number;
}

export function toOfferPackage(source: PackageSource): OfferPackage {
  return {
    id: source.packageId ?? source.publicId ?? '',
    name: source.name ?? '',
    price: source.price ?? 0,
    currency: source.currency ?? PaymentCurrency.CZK,
    billing: source.billing ?? PackageBillingInterval.Monthly,
    intervalWeeks: source.intervalWeeks,
  };
}

/** "Every month", "Every 5 weeks" or "One-off": the long form of how a package is billed. */
export function billingDescription(
  t: TFunction,
  billing: PackageBillingInterval,
  intervalWeeks: number | undefined,
): string {
  switch (billing) {
    case PackageBillingInterval.EveryNWeeks:
      return t('offer.billingLong.everyWeeks', { count: intervalWeeks ?? 1 });
    case PackageBillingInterval.OneOff:
      return t('offer.billingLong.oneOff');
    default:
      return t('offer.billingLong.monthly');
  }
}

/** The coach-package shape the discount helpers expect. */
function asCoachPackage(pkg: OfferPackage): CoachPackageDto {
  return {
    packageId: pkg.id,
    name: pkg.name,
    price: pkg.price,
    currency: pkg.currency,
    billing: pkg.billing,
    intervalWeeks: pkg.intervalWeeks,
  };
}

/** Today as an ISO date (yyyy-mm-dd), the form `validTo` is stored in. */
function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Discounts a coach can still hand out: not archived, and not past their last day. */
export function usableDiscounts(discounts: readonly CoachDiscountDto[], now: Date = new Date()): CoachDiscountDto[] {
  const today = todayIso(now);
  return discounts.filter(
    (discount) => !discount.archivedAt && (!discount.validTo || discount.validTo.slice(0, 10) >= today),
  );
}

/** Why a discount cannot go with the package (null when it can). Without a package nothing fits. */
export function discountBlock(discount: CoachDiscountDto, pkg: OfferPackage | undefined): DiscountMismatch | null {
  return pkg ? discountMismatch(discount, asCoachPackage(pkg)) : 'scope';
}

export interface OfferPrice {
  base: number;
  payable: number;
  currency: PaymentCurrency;
  /** Set when the discount covers only the first N payments. */
  firstPayments?: number;
}

/** The price the client pays per period with the discount applied, as the server would compute it. */
export function offerPrice(pkg: OfferPackage, discount: CoachDiscountDto | undefined): OfferPrice {
  return {
    base: pkg.price,
    payable: Math.max(0, pkg.price - previewDiscountAmount(discount, pkg.price)),
    currency: pkg.currency,
    firstPayments: discount?.duration === DiscountDuration.FirstPayments ? discount.durationPayments : undefined,
  };
}

/** The longest message the coach can send with an offer. */
export const OFFER_MESSAGE_MAX_LENGTH = 500;
