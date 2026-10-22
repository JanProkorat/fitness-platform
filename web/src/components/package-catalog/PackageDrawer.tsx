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
  FIELD_CLASS,
  SectionHeading,
  SELECT_CLASS,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import { FieldHint, FormError, type SaveOutcome } from '@/components/package-catalog/packageFormParts';
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
          <label className={FIELD_CLASS}>
            <span>{t('packages.drawer.name')}</span>
            <Input {...register('name')} aria-invalid={errors.name ? true : undefined} />
            <FormError message={errors.name?.message} />
          </label>
          <label className={FIELD_CLASS}>
            <span>{t('packages.drawer.included')}</span>
            <Textarea
              {...register('description')}
              rows={3}
              aria-invalid={errors.description ? true : undefined}
            />
            <FormError message={errors.description?.message} />
            <FieldHint>{t('packages.drawer.includedHint')}</FieldHint>
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Wallet className="size-4" />}>{t('packages.drawer.sectionPrice')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <label className={FIELD_CLASS}>
              <span>{t('packages.drawer.price')}</span>
              <Input
                {...register('price')}
                inputMode="decimal"
                aria-invalid={errors.price ? true : undefined}
              />
              <FormError message={errors.price?.message} />
            </label>
            <label className={FIELD_CLASS}>
              <span>{t('packages.drawer.currency')}</span>
              <span className="relative">
                <select {...register('currency')} disabled={currencyLocked} className={SELECT_CLASS}>
                  <option value={PaymentCurrency.CZK}>{PaymentCurrency.CZK}</option>
                  <option value={PaymentCurrency.EUR}>{PaymentCurrency.EUR}</option>
                </select>
                <SelectChevron />
              </span>
              {currencyLocked && <FieldHint>{t('packages.drawer.currencyLocked')}</FieldHint>}
            </label>
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
            <label className={FIELD_CLASS}>
              <span>{t('packages.drawer.intervalWeeks')}</span>
              <Input
                {...register('intervalWeeks')}
                inputMode="numeric"
                aria-invalid={errors.intervalWeeks ? true : undefined}
              />
              <FormError message={errors.intervalWeeks?.message} />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            {billing !== PackageBillingInterval.OneOff && (
              <label className={FIELD_CLASS}>
                <span>{t('packages.drawer.runsFor')}</span>
                <Input
                  {...register('runsForPayments')}
                  inputMode="numeric"
                  placeholder={t('packages.drawer.runsForPlaceholder')}
                  aria-invalid={errors.runsForPayments ? true : undefined}
                />
                <FormError message={errors.runsForPayments?.message} />
                <FieldHint>{t('packages.drawer.runsForHint')}</FieldHint>
              </label>
            )}
            <label className={FIELD_CLASS}>
              <span>{t('packages.drawer.paymentDue')}</span>
              <Input
                {...register('paymentDueDaysOverride')}
                inputMode="numeric"
                placeholder={t('packages.drawer.paymentDuePlaceholder')}
                aria-invalid={errors.paymentDueDaysOverride ? true : undefined}
              />
              <FormError message={errors.paymentDueDaysOverride?.message} />
              <FieldHint>{t('packages.drawer.paymentDueHint')}</FieldHint>
            </label>
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
