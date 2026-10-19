import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AutomationTriggerKind, type AutomationRuleDto } from '@/api/automations';
import { FIELD_CLASS, FieldError } from '@/components/automations/automationFormParts';
import AutomationOptionsSection from '@/components/automations/AutomationOptionsSection';
import AutomationWhatSection from '@/components/automations/AutomationWhatSection';
import AutomationWhenSection from '@/components/automations/AutomationWhenSection';
import AutomationWhoSection from '@/components/automations/AutomationWhoSection';
import { summaryFooter } from '@/components/automations/automationFormat';
import {
  automationRuleSchema,
  defaultRuleValues,
  ruleToFormValues,
  summarySensitiveSnapshot,
  type AutomationDrawerVariant,
  type AutomationRuleFormValues,
} from '@/components/automations/automationRuleForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** global: the Automations page; clientOnly: a rule of one client; override: a client's change to a global rule. */
  variant?: AutomationDrawerVariant;
  /** The saved rule being edited; undefined for a new rule. */
  rule?: AutomationRuleDto;
  /** Saves the form. Resolves when the save is done and never rejects; the caller reports errors. */
  onSubmit: (values: AutomationRuleFormValues) => Promise<void>;
  isSaving: boolean;
}

/** Side drawer to create or edit an automation rule: Name, then When, What, Who and Options. */
export default function AutomationRuleDrawer({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 sm:w-drawer sm:max-w-none">
        <DrawerBody key={rest.rule?.ruleId ?? 'new'} onClose={() => onOpenChange(false)} {...rest} />
      </SheetContent>
    </Sheet>
  );
}

interface BodyProps extends Omit<Props, 'open' | 'onOpenChange'> {
  onClose: () => void;
}

function DrawerBody({ variant = 'global', rule, onSubmit, isSaving, onClose }: BodyProps) {
  const { t, i18n } = useTranslation();
  const [initial] = useState<AutomationRuleFormValues>(() => (rule ? ruleToFormValues(rule) : defaultRuleValues()));
  const [initialSnapshot] = useState(() => summarySensitiveSnapshot(initial));

  const methods = useForm<AutomationRuleFormValues>({
    resolver: zodResolver(automationRuleSchema),
    defaultValues: initial,
  });
  const { register, handleSubmit, control } = methods;
  const values = useWatch({ control });

  const triggerKind = values.triggerKind ?? initial.triggerKind;
  const isNew = rule === undefined;
  const sensitiveChanged =
    summarySensitiveSnapshot({ ...initial, ...values } as AutomationRuleFormValues) !== initialSnapshot;
  const footer = isNew || sensitiveChanged ? null : summaryFooter(rule?.summary, t, i18n.language);

  const title = isNew
    ? t('automations.drawer.titleNew')
    : t('automations.drawer.titleEdit', { name: rule.name ?? '' });
  const description =
    triggerKind === AutomationTriggerKind.Event
      ? t('automations.drawer.descriptionEvent')
      : t('automations.drawer.descriptionSchedule');

  return (
    <form onSubmit={handleSubmit((submitted) => onSubmit(submitted))} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b border-border px-6 py-5 pr-14">
        <SheetTitle className="text-auth-title">{title}</SheetTitle>
        <SheetDescription className="text-body">
          {description}
        </SheetDescription>
      </SheetHeader>

      <FormProvider {...methods}>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          {variant !== 'override' && (
            <label className={FIELD_CLASS}>
              <span>{t('automations.drawer.name')}</span>
              <Input {...register('name')} placeholder={t('automations.drawer.namePlaceholder')} />
              <FieldError name="name" />
            </label>
          )}
          <AutomationWhenSection />
          <AutomationWhatSection actionLocked={variant === 'override'} />
          {variant === 'global' && <AutomationWhoSection initialClients={rule?.clients} />}
          <AutomationOptionsSection />
        </div>
      </FormProvider>

      <SheetFooter className="flex-row items-center gap-2 border-t border-border px-6 py-4">
        {footer && <span className="mr-auto text-meta text-muted-foreground">{footer}</span>}
        <Button type="button" variant="outline" size="lg" className={footer ? undefined : 'ml-auto'} onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={isSaving}>
          <Check aria-hidden="true" />
          {isSaving ? t('automations.drawer.saving') :t('automations.drawer.save')}
        </Button>
      </SheetFooter>
    </form>
  );
}
