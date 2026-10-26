import { z } from 'zod';
import {
  DiscountDuration,
  DiscountScope,
  DiscountType,
  type CoachDiscountDto,
  type CreateCoachDiscountRequest,
} from '@/api/coach-discounts';
import { PaymentCurrency } from '@/api/coach-packages';
import { MAX_AMOUNT, PACKAGE_NAME_MAX, intInRange } from '@/components/package-catalog/packageForm';
import { parseAmount } from '@/lib/money';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const discountSchema = z
  .object({
    name: z.string(),
    type: z.enum(DiscountType),
    value: z.string(),
    currency: z.enum(PaymentCurrency),
    scope: z.enum(DiscountScope),
    packageIds: z.array(z.string()),
    validFrom: z.string(),
    validTo: z.string(),
    duration: z.enum(DiscountDuration),
    durationPayments: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: keyof DiscountFormValues, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    const name = values.name.trim();
    if (!name) {
      fail('name', 'packages.discounts.validation.nameRequired');
    } else if (name.length > PACKAGE_NAME_MAX) {
      fail('name', 'packages.discounts.validation.nameTooLong');
    }

    const value = parseAmount(values.value);
    if (values.type === DiscountType.Percentage) {
      if (value === null || value < 1 || value > 100) {
        fail('value', 'packages.discounts.validation.percentage');
      }
    } else if (value === null || value <= 0) {
      fail('value', 'packages.discounts.validation.amountInvalid');
    } else if (value > MAX_AMOUNT[values.currency]) {
      fail('value', 'packages.discounts.validation.amountTooHigh');
    }

    if (values.scope === DiscountScope.SelectedPackages && values.packageIds.length === 0) {
      fail('packageIds', 'packages.discounts.validation.packagesRequired');
    }

    if (values.validFrom !== '' && !DATE_PATTERN.test(values.validFrom)) {
      fail('validFrom', 'packages.discounts.validation.dateInvalid');
    }
    if (values.validTo !== '' && !DATE_PATTERN.test(values.validTo)) {
      fail('validTo', 'packages.discounts.validation.dateInvalid');
    } else if (values.validFrom !== '' && values.validTo !== '' && values.validTo < values.validFrom) {
      fail('validTo', 'packages.discounts.validation.dateOrder');
    }

    if (values.duration === DiscountDuration.FirstPayments && !intInRange(values.durationPayments, 1, 120)) {
      fail('durationPayments', 'packages.discounts.validation.durationPayments');
    }
  });

export type DiscountFormValues = z.infer<typeof discountSchema>;

export function defaultDiscountValues(): DiscountFormValues {
  return {
    name: '',
    type: DiscountType.Percentage,
    value: '',
    currency: PaymentCurrency.CZK,
    scope: DiscountScope.AllPackages,
    packageIds: [],
    validFrom: '',
    validTo: '',
    duration: DiscountDuration.EveryPayment,
    durationPayments: '',
  };
}

/** Only still-active packages can stay selected; archived ones are dropped from the form. */
export function discountToFormValues(item: CoachDiscountDto, activePackageIds: ReadonlySet<string>): DiscountFormValues {
  return {
    name: item.name ?? '',
    type: item.type ?? DiscountType.Percentage,
    value: item.value == null ? '' : String(item.value),
    currency: item.currency ?? PaymentCurrency.CZK,
    scope: item.scope ?? DiscountScope.AllPackages,
    packageIds: (item.packageIds ?? []).filter((id) => activePackageIds.has(id)),
    validFrom: item.validFrom?.slice(0, 10) ?? '',
    validTo: item.validTo?.slice(0, 10) ?? '',
    duration: item.duration ?? DiscountDuration.EveryPayment,
    durationPayments: item.durationPayments == null ? '' : String(item.durationPayments),
  };
}

/** Builds the create/update body; fields the chosen type, scope or duration does not use are omitted. */
export function discountValuesToRequest(values: DiscountFormValues): CreateCoachDiscountRequest {
  const isFixed = values.type === DiscountType.FixedAmount;
  return {
    name: values.name.trim(),
    type: values.type,
    value: parseAmount(values.value) ?? 0,
    currency: isFixed ? values.currency : undefined,
    scope: values.scope,
    packageIds: values.scope === DiscountScope.SelectedPackages ? values.packageIds : [],
    validFrom: values.validFrom === '' ? undefined : values.validFrom,
    validTo: values.validTo === '' ? undefined : values.validTo,
    duration: values.duration,
    durationPayments: values.duration === DiscountDuration.FirstPayments ? Number(values.durationPayments) : undefined,
  };
}
