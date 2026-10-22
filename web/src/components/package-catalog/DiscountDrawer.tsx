import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Calendar, Check, Package, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DiscountDuration, DiscountScope, DiscountType, type CoachDiscountDto } from '@/api/coach-discounts';
import { PaymentCurrency, type CoachPackageDto } from '@/api/coach-packages';
import {
  ChoiceButton,
  SectionHeading,
  SELECT_CLASS,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import { Field, FieldHint, FormError, type SaveOutcome } from '@/components/package-catalog/packageFormParts';
import {
  defaultDiscountValues,
  discountSchema,
  discountToFormValues,
  type DiscountFormValues,
} from '@/components/package-catalog/discountForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved discount being edited; undefined for a new discount. */
  item?: CoachDiscountDto;
  /** Active packages a discount can be limited to. */
  packages: CoachPackageDto[];
  /** Saves the form. Never rejects; the caller reports errors and returns what happened. */
  onSubmit: (values: DiscountFormValues) => Promise<SaveOutcome>;
  isSaving: boolean;
}

const SCOPE_OPTIONS: { value: DiscountScope; labelKey: string }[] = [
  { value: DiscountScope.AllPackages, labelKey: 'packages.discounts.scope.AllPackages' },
  { value: DiscountScope.MonthlyPackages, labelKey: 'packages.discounts.scope.MonthlyPackages' },
  { value: DiscountScope.SelectedPackages, labelKey: 'packages.discounts.scope.SelectedPackages' },
];

/** Side drawer to create or edit a discount: name, type and value, packages it applies to, validity window. */
export default function DiscountDrawer({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 sm:w-drawer sm:max-w-none">
        <DrawerBody key={rest.item?.discountId ?? 'new'} onClose={() => onOpenChange(false)} {...rest} />
      </SheetContent>
    </Sheet>
  );
}

interface BodyProps extends Omit<Props, 'open' | 'onOpenChange'> {
  onClose: () => void;
}

function DrawerBody({ item, packages, onSubmit, isSaving, onClose }: BodyProps) {
  const { t } = useTranslation();
  const [initial] = useState<DiscountFormValues>(() =>
    item
      ? discountToFormValues(item, new Set(packages.map((pkg) => pkg.packageId ?? '')))
      : defaultDiscountValues(),
  );
  const isNew = item === undefined;
  // The backend refuses a currency change while client terms use the discount.
  const currencyLocked = (item?.usedByCount ?? 0) > 0;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: initial,
  });
  const type = useWatch({ control, name: 'type' });
  const scope = useWatch({ control, name: 'scope' });
  const duration = useWatch({ control, name: 'duration' });

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
          {isNew ? t('packages.discounts.drawer.titleNew') : t('packages.discounts.drawer.titleEdit', { name: item?.name ?? '' })}
        </SheetTitle>
        <SheetDescription className="text-body">{t('packages.discounts.drawer.description')}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Tag className="size-4" />}>{t('packages.discounts.drawer.sectionDiscount')}</SectionHeading>
          <Field
            label={t('packages.discounts.drawer.name')}
            error={errors.name?.message}
            hint={t('packages.discounts.drawer.nameHint')}
          >
            {(control) => <Input {...register('name')} {...control} />}
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink-2">{t('packages.discounts.drawer.type')}</span>
            <div role="group" aria-label={t('packages.discounts.drawer.type')} className="grid grid-cols-2 gap-2">
              <ChoiceButton
                selected={type === DiscountType.Percentage}
                icon={null}
                onClick={() => setValue('type', DiscountType.Percentage, { shouldDirty: true })}
              >
                {t('packages.discounts.type.Percentage')}
              </ChoiceButton>
              <ChoiceButton
                selected={type === DiscountType.FixedAmount}
                icon={null}
                onClick={() => setValue('type', DiscountType.FixedAmount, { shouldDirty: true })}
              >
                {t('packages.discounts.type.FixedAmount')}
              </ChoiceButton>
            </div>
          </div>

          <div className={type === DiscountType.FixedAmount ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1'}>
            <Field label={t('packages.discounts.drawer.value')} error={errors.value?.message}>
              {(control) => <Input {...register('value')} inputMode="decimal" {...control} />}
            </Field>
            {type === DiscountType.FixedAmount && (
              <Field
                label={t('packages.drawer.currency')}
                hint={currencyLocked ? t('packages.discounts.drawer.currencyLocked') : undefined}
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
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading icon={<Package className="size-4" />}>{t('packages.discounts.drawer.sectionAppliesTo')}</SectionHeading>
          <div role="group" aria-label={t('packages.discounts.drawer.sectionAppliesTo')} className="grid grid-cols-3 gap-2">
            {SCOPE_OPTIONS.map(({ value, labelKey }) => (
              <ChoiceButton
                key={value}
                selected={scope === value}
                icon={null}
                onClick={() => setValue('scope', value, { shouldDirty: true })}
              >
                {t(labelKey)}
              </ChoiceButton>
            ))}
          </div>
          {scope === DiscountScope.SelectedPackages && (
            <Controller
              control={control}
              name="packageIds"
              render={({ field }) => (
                <div className="flex flex-col gap-2.5">
                  {packages.length === 0 && (
                    <FieldHint>{t('packages.discounts.drawer.noPackages')}</FieldHint>
                  )}
                  {packages.map((pkg) => {
                    const id = pkg.packageId ?? '';
                    const checked = field.value.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2.5 text-copy text-ink">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.onChange(next === true ? [...field.value, id] : field.value.filter((value) => value !== id))
                          }
                        />
                        {pkg.name}
                      </label>
                    );
                  })}
                  <FormError message={errors.packageIds?.message} />
                </div>
              )}
            />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading icon={<Calendar className="size-4" />}>{t('packages.discounts.drawer.sectionWhen')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('packages.discounts.drawer.validFrom')} error={errors.validFrom?.message}>
              {(control) => <Input type="date" {...register('validFrom')} {...control} />}
            </Field>
            <Field
              label={t('packages.discounts.drawer.validTo')}
              error={errors.validTo?.message}
              hint={t('common.optional')}
            >
              {(control) => <Input type="date" {...register('validTo')} {...control} />}
            </Field>
          </div>
          <p className="text-body text-muted-foreground">{t('packages.discounts.drawer.windowNote')}</p>

          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink-2">{t('packages.discounts.drawer.duration')}</span>
            <div role="group" aria-label={t('packages.discounts.drawer.duration')} className="grid grid-cols-2 gap-2">
              <ChoiceButton
                selected={duration === DiscountDuration.EveryPayment}
                icon={null}
                onClick={() => setValue('duration', DiscountDuration.EveryPayment, { shouldDirty: true })}
              >
                {t('packages.discounts.duration.EveryPayment')}
              </ChoiceButton>
              <ChoiceButton
                selected={duration === DiscountDuration.FirstPayments}
                icon={null}
                onClick={() => setValue('duration', DiscountDuration.FirstPayments, { shouldDirty: true })}
              >
                {t('packages.discounts.duration.FirstPaymentsChoice')}
              </ChoiceButton>
            </div>
          </div>
          {duration === DiscountDuration.FirstPayments && (
            <Field label={t('packages.discounts.drawer.firstPayments')} error={errors.durationPayments?.message}>
              {(control) => <Input {...register('durationPayments')} inputMode="numeric" {...control} />}
            </Field>
          )}
        </section>
      </div>

      <SheetFooter className="flex-row items-center gap-2 border-t border-border px-6 py-4">
        <span className="mr-auto text-meta text-muted-foreground">{t('packages.discounts.drawer.footer')}</span>
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={isSaving}>
          <Check aria-hidden="true" />
          {isSaving ? t('packages.discounts.drawer.saving') : t('packages.discounts.drawer.save')}
        </Button>
      </SheetFooter>
    </form>
  );
}
