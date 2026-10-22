import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Check, Eye, Info, Package, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PackageBillingInterval, PaymentCurrency, type CoachPackageDto } from '@/api/coach-packages';
import {
  ChoiceButton,
  SectionHeading,
  SELECT_CLASS,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import { Field, FieldHint, type SaveOutcome } from '@/components/package-catalog/packageFormParts';
import { formatMoney } from '@/lib/money';
import {
  MAX_AMOUNT,
  defaultPackageValues,
  packageSchema,
  packageToFormValues,
  type PackageFormValues,
} from '@/components/package-catalog/packageForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved package being edited; undefined for a new package. */
  item?: CoachPackageDto;
  /** Saves the form. Never rejects; the caller reports errors and returns what happened. */
  onSubmit: (values: PackageFormValues) => Promise<SaveOutcome>;
  isSaving: boolean;
}

const BILLING_OPTIONS: { value: PackageBillingInterval; labelKey: string }[] = [
  { value: PackageBillingInterval.Monthly, labelKey: 'packages.billing.Monthly' },
  { value: PackageBillingInterval.EveryNWeeks, labelKey: 'packages.billing.EveryNWeeks' },
  { value: PackageBillingInterval.OneOff, labelKey: 'packages.billing.OneOff' },
];

/** Number of payments a package can run for, besides "until you stop it" (API range 1-120). */
const RUNS_FOR_OPTIONS = [3, 6, 12, 24] as const;
/** Days after the request a payment is due, besides the coach's default (API range 1-90). */
const PAYMENT_DUE_OPTIONS = [7, 14, 30] as const;

/** The preset options plus the saved value when it is not one of them, sorted ascending. */
function withCurrent(presets: readonly number[], saved: string): number[] {
  const current = saved.trim() === '' ? null : Number(saved);
  return current === null || presets.includes(current) ? [...presets] : [...presets, current].sort((a, b) => a - b);
}

/** Side drawer to create or edit a package: what is included, price and billing, visibility. */
export default function PackageDrawer({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 sm:w-drawer sm:max-w-none">
        <DrawerBody key={rest.item?.packageId ?? 'new'} onClose={() => onOpenChange(false)} {...rest} />
      </SheetContent>
    </Sheet>
  );
}

interface BodyProps extends Omit<Props, 'open' | 'onOpenChange'> {
  onClose: () => void;
}

function DrawerBody({ item, onSubmit, isSaving, onClose }: BodyProps) {
  const { t, i18n } = useTranslation();
  const [initial] = useState<PackageFormValues>(() => (item ? packageToFormValues(item) : defaultPackageValues()));
  const isNew = item === undefined;
  // The backend refuses a currency change while client terms use the package.
  const currencyLocked = (item?.clientCount ?? 0) > 0;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: initial,
  });
  const billing = useWatch({ control, name: 'billing' });
  const currency = useWatch({ control, name: 'currency' });

  const submit = handleSubmit(async (values) => {
    const outcome = await onSubmit(values);
    if (outcome === 'currencyLocked') {
      setValue('currency', initial.currency);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b border-border px-6 py-5 pr-14">
        <SheetTitle className="text-auth-title">
          {isNew ? t('packages.drawer.titleNew') : t('packages.drawer.titleEdit', { name: item?.name ?? '' })}
        </SheetTitle>
        <SheetDescription className="text-body">{t('packages.drawer.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Package className="size-4" />}>{t('packages.drawer.sectionPackage')}</SectionHeading>
          <Field label={t('packages.drawer.name')} error={errors.name?.message}>
            {(control) => <Input {...register('name')} {...control} />}
          </Field>
          <Field
            label={t('packages.drawer.included')}
            error={errors.description?.message}
            hint={t('packages.drawer.includedHint')}
          >
            {(control) => <Textarea {...register('description')} rows={3} {...control} />}
          </Field>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Wallet className="size-4" />}>{t('packages.drawer.sectionPrice')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('packages.drawer.price')} error={errors.price?.message}>
              {(control) => <Input {...register('price')} inputMode="decimal" {...control} />}
            </Field>
            <Field
              label={t('packages.drawer.currency')}
              hint={currencyLocked ? t('packages.drawer.currencyLocked') : undefined}
            >
              {(control) => (
                <span className="relative">
                  <select {...register('currency')} disabled={currencyLocked} className={SELECT_CLASS} {...control}>
                    <option value={PaymentCurrency.CZK}>{PaymentCurrency.CZK}</option>
                    <option value={PaymentCurrency.EUR}>{PaymentCurrency.EUR}</option>
                  </select>
                  <SelectChevron />
                </span>
              )}
            </Field>
          </div>
          <FieldHint>
            {t('packages.drawer.priceCap', {
              max: formatMoney(MAX_AMOUNT[currency], currency, i18n.language),
            })}
          </FieldHint>

          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink-2">{t('packages.drawer.billing')}</span>
            <div role="group" aria-label={t('packages.drawer.billing')} className="grid grid-cols-3 gap-2">
              {BILLING_OPTIONS.map(({ value, labelKey }) => (
                <ChoiceButton
                  key={value}
                  selected={billing === value}
                  icon={null}
                  onClick={() => setValue('billing', value, { shouldDirty: true })}
                >
                  {t(labelKey)}
                </ChoiceButton>
              ))}
            </div>
          </div>

          {billing === PackageBillingInterval.EveryNWeeks && (
            <Field label={t('packages.drawer.intervalWeeks')} error={errors.intervalWeeks?.message}>
              {(control) => <Input {...register('intervalWeeks')} inputMode="numeric" {...control} />}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            {billing !== PackageBillingInterval.OneOff && (
              <Field
                label={t('packages.drawer.runsFor')}
                error={errors.runsForPayments?.message}
                hint={t('packages.drawer.runsForHint')}
              >
                {(control) => (
                  <span className="relative">
                    <select {...register('runsForPayments')} className={SELECT_CLASS} {...control}>
                      <option value="">{t('packages.drawer.runsForPlaceholder')}</option>
                      {withCurrent(RUNS_FOR_OPTIONS, initial.runsForPayments).map((count) => (
                        <option key={count} value={String(count)}>
                          {t('packages.drawer.runsForOption', { count })}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </span>
                )}
              </Field>
            )}
            <Field
              label={t('packages.drawer.paymentDue')}
              error={errors.paymentDueDaysOverride?.message}
              hint={t('packages.drawer.paymentDueHint')}
            >
              {(control) => (
                <span className="relative">
                  <select {...register('paymentDueDaysOverride')} className={SELECT_CLASS} {...control}>
                    <option value="">{t('packages.drawer.paymentDuePlaceholder')}</option>
                    {withCurrent(PAYMENT_DUE_OPTIONS, initial.paymentDueDaysOverride).map((count) => (
                      <option key={count} value={String(count)}>
                        {t('packages.drawer.paymentDueOption', { count })}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </span>
              )}
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Eye className="size-4" />}>{t('packages.drawer.sectionVisibility')}</SectionHeading>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span id="package-show-on-profile" className="text-copy font-semibold text-ink">
                {t('packages.drawer.showOnProfile')}
              </span>
              <span className="text-meta text-muted-foreground">{t('packages.drawer.showOnProfileHint')}</span>
            </div>
            <Controller
              control={control}
              name="showOnProfile"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-labelledby="package-show-on-profile"
                />
              )}
            />
          </div>
          <p className="flex items-start gap-2.5 rounded-field bg-sunken px-4 py-3.5 text-body text-ink-2">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {t('packages.drawer.priceChangeNote')}
          </p>
        </section>
      </div>

      <SheetFooter className="flex-row items-center gap-2 border-t border-border px-6 py-4">
        <span className="mr-auto text-meta text-muted-foreground">{t('packages.drawer.footer')}</span>
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={isSaving}>
          <Check aria-hidden="true" />
          {isSaving ? t('packages.drawer.saving') : t('packages.drawer.save')}
        </Button>
      </SheetFooter>
    </form>
  );
}
