import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AutomationTriggerKind } from '@/api/automations';
import { FieldError } from '@/components/automations/automationFormParts';
import { isPlanEvent, type AutomationRuleFormValues } from '@/components/automations/automationRuleForm';

interface OptionProps {
  name: 'skipWhilePreviousUnanswered' | 'stopAfterEnabled' | 'oncePerPlan';
  label: string;
  hint?: string;
}

function CheckboxOption({ name, label, hint }: OptionProps) {
  const { control } = useFormContext<AutomationRuleFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            className="mt-1"
            checked={field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
          />
          <span className="flex flex-col">
            <span className="text-copy text-ink">{label}</span>
            {hint && <span className="text-meta text-muted-foreground">{hint}</span>}
          </span>
        </label>
      )}
    />
  );
}

/** Section 4: skip while unanswered, stop after N sends, and once per plan for plan events. */
export default function AutomationOptionsSection() {
  const { t } = useTranslation();
  const { register, control } = useFormContext<AutomationRuleFormValues>();
  const stopAfterEnabled = useWatch({ control, name: 'stopAfterEnabled' });
  const triggerKind = useWatch({ control, name: 'triggerKind' });
  const eventType = useWatch({ control, name: 'eventType' });
  const showOncePerPlan = triggerKind === AutomationTriggerKind.Event && isPlanEvent(eventType);

  return (
    <section className="flex flex-col gap-3" aria-label={t('automations.drawer.options.heading')}>
      <CheckboxOption
        name="skipWhilePreviousUnanswered"
        label={t('automations.drawer.options.skip')}
        hint={t('automations.drawer.options.skipHint')}
      />
      <div className="flex flex-col gap-2">
        <CheckboxOption name="stopAfterEnabled" label={t('automations.drawer.options.stopAfter')} />
        {stopAfterEnabled && (
          <div className="ml-6.5 flex flex-col gap-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              className="w-28"
              aria-label={t('automations.drawer.options.stopAfterCount')}
              {...register('stopAfterSends')}
            />
            <FieldError name="stopAfterSends" />
          </div>
        )}
      </div>
      {showOncePerPlan && (
        <CheckboxOption
          name="oncePerPlan"
          label={t('automations.drawer.options.oncePerPlan')}
          hint={t('automations.drawer.options.oncePerPlanHint')}
        />
      )}
    </section>
  );
}
