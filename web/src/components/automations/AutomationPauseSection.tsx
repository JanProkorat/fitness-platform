import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pause } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FIELD_CLASS, FieldError, SectionHeading } from '@/components/automations/automationFormParts';
import {
  PAUSE_NOTE_MAX,
  todayIsoDate,
  type AutomationRuleFormValues,
} from '@/components/automations/automationRuleForm';

/** Client override only: pause the rule for this client, with an optional end date and note. */
export default function AutomationPauseSection() {
  const { t } = useTranslation();
  const { register, control, setValue } = useFormContext<AutomationRuleFormValues>();
  const paused = useWatch({ control, name: 'paused' });
  const note = useWatch({ control, name: 'pauseNote' }) ?? '';

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={<Pause className="size-4" />}>{t('automations.drawer.pause.heading')}</SectionHeading>
      <Controller
        control={control}
        name="paused"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-copy text-ink">{t('automations.drawer.pause.toggle')}</span>
              <span className="text-meta text-muted-foreground">{t('automations.drawer.pause.hint')}</span>
            </span>
            <Switch
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                if (!checked) {
                  // Resuming clears the date and note on the server, so clear them here too.
                  setValue('pausedUntil', '', { shouldDirty: true });
                  setValue('pauseNote', '', { shouldDirty: true });
                }
              }}
              aria-label={t('automations.drawer.pause.toggle')}
            />
          </label>
        )}
      />
      <label className={FIELD_CLASS}>
        <span>{t('automations.drawer.pause.until')}</span>
        <Input type="date" min={todayIsoDate()} disabled={!paused} {...register('pausedUntil')} />
        <span className="text-meta font-normal text-muted-foreground">{t('automations.drawer.pause.untilHint')}</span>
        <FieldError name="pausedUntil" />
      </label>
      <label className={FIELD_CLASS}>
        <span>{t('automations.drawer.pause.note')}</span>
        <Input
          disabled={!paused}
          placeholder={t('automations.drawer.pause.notePlaceholder')}
          {...register('pauseNote')}
        />
        <span className="flex items-start justify-between gap-2">
          <FieldError name="pauseNote" />
          <span className="ml-auto text-meta font-normal text-muted-foreground">
            {t('automations.drawer.what.counter', { current: note.length, max: PAUSE_NOTE_MAX })}
          </span>
        </span>
      </label>
    </section>
  );
}
