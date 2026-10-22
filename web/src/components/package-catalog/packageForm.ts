import { z } from 'zod';
import {
  PackageBillingInterval,
  PaymentCurrency,
  type CoachPackageDto,
  type CreateCoachPackageRequest,
} from '@/api/coach-packages';

export const PACKAGE_NAME_MAX = 100;
export const PACKAGE_DESCRIPTION_MAX = 500;

/** Highest price per currency; mirrors the backend validator. */
export const MAX_AMOUNT: Record<PaymentCurrency, number> = {
  [PaymentCurrency.CZK]: 1_000_000,
  [PaymentCurrency.EUR]: 50_000,
};

const INT_PATTERN = /^\d+$/;
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** Parses a typed amount ("2 500", "75,50"); null when it is not a number with up to 2 decimals. */
export function parseAmount(raw: string): number | null {
  const normalised = raw.replace(/\s/g, '');
  if (!AMOUNT_PATTERN.test(normalised)) {
    return null;
  }
  return Number(normalised.replace(',', '.'));
}

export const intInRange = (raw: string, min: number, max: number): boolean => {
  const value = raw.trim();
  return INT_PATTERN.test(value) && Number(value) >= min && Number(value) <= max;
};

export const packageSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    price: z.string(),
    currency: z.enum(PaymentCurrency),
    billing: z.enum(PackageBillingInterval),
    intervalWeeks: z.string(),
    runsForPayments: z.string(),
    paymentDueDaysOverride: z.string(),
    showOnProfile: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: keyof PackageFormValues, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    const name = values.name.trim();
    if (!name) {
      fail('name', 'packages.validation.nameRequired');
    } else if (name.length > PACKAGE_NAME_MAX) {
      fail('name', 'packages.validation.nameTooLong');
    }
    if (values.description.trim().length > PACKAGE_DESCRIPTION_MAX) {
      fail('description', 'packages.validation.descriptionTooLong');
    }

    const price = parseAmount(values.price);
    if (price === null || price <= 0) {
      fail('price', 'packages.validation.priceInvalid');
    } else if (price > MAX_AMOUNT[values.currency]) {
      fail('price', 'packages.validation.priceTooHigh');
    }

    if (values.billing === PackageBillingInterval.EveryNWeeks && !intInRange(values.intervalWeeks, 1, 52)) {
      fail('intervalWeeks', 'packages.validation.intervalWeeks');
    }
    if (
      values.billing !== PackageBillingInterval.OneOff &&
      values.runsForPayments.trim() !== '' &&
      !intInRange(values.runsForPayments, 1, 120)
    ) {
      fail('runsForPayments', 'packages.validation.runsFor');
    }
    if (values.paymentDueDaysOverride.trim() !== '' && !intInRange(values.paymentDueDaysOverride, 1, 90)) {
      fail('paymentDueDaysOverride', 'packages.validation.paymentDue');
    }
  });

export type PackageFormValues = z.infer<typeof packageSchema>;

export function defaultPackageValues(): PackageFormValues {
  return {
    name: '',
    description: '',
    price: '',
    currency: PaymentCurrency.CZK,
    billing: PackageBillingInterval.Monthly,
    intervalWeeks: '',
    runsForPayments: '',
    paymentDueDaysOverride: '',
    showOnProfile: true,
  };
}

export function packageToFormValues(item: CoachPackageDto): PackageFormValues {
  return {
    name: item.name ?? '',
    description: item.description ?? '',
    price: item.price === undefined ? '' : String(item.price),
    currency: item.currency ?? PaymentCurrency.CZK,
    billing: item.billing ?? PackageBillingInterval.Monthly,
    intervalWeeks: item.intervalWeeks === undefined ? '' : String(item.intervalWeeks),
    runsForPayments: item.runsForPayments === undefined ? '' : String(item.runsForPayments),
    paymentDueDaysOverride: item.paymentDueDaysOverride === undefined ? '' : String(item.paymentDueDaysOverride),
    showOnProfile: item.showOnProfile ?? false,
  };
}

/** Builds the create/update body; fields a billing type does not use are omitted. */
export function formValuesToRequest(values: PackageFormValues): CreateCoachPackageRequest {
  const description = values.description.trim();
  const optionalInt = (raw: string): number | undefined => (raw.trim() === '' ? undefined : Number(raw));
  return {
    name: values.name.trim(),
    description: description === '' ? undefined : description,
    price: parseAmount(values.price) ?? 0,
    currency: values.currency,
    billing: values.billing,
    intervalWeeks: values.billing === PackageBillingInterval.EveryNWeeks ? optionalInt(values.intervalWeeks) : undefined,
    runsForPayments: values.billing === PackageBillingInterval.OneOff ? undefined : optionalInt(values.runsForPayments),
    paymentDueDaysOverride: optionalInt(values.paymentDueDaysOverride),
    showOnProfile: values.showOnProfile,
  };
}
