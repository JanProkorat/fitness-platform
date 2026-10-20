import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Clock, Flag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationScheduleUnit,
  AutomationTriggerKind,
} from '@/api/automations';
import {
  FIELD_CLASS,
  ChoiceButton,
  FieldError,
  SELECT_CLASS,
  SectionHeading,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import {
  DEFAULT_EVENT_TIME,
  EVENT_TYPES,
  isPlanEvent,
  type AutomationRuleFormValues,
} from '@/components/automations/automationRuleForm';

/** Section 1: schedule or event trigger, with its timing fields. */
export default function AutomationWhenSection() {
  const { t } = useTranslation();
  const { register, setValue, control, getValues } = useFormContext<AutomationRuleFormValues>();
  const triggerKind = useWatch({ control, name: 'triggerKind' });
  const eventType = useWatch({ control, name: 'eventType' });
  const isSchedule = triggerKind === AutomationTriggerKind.Schedule;
  const planEvent = isPlanEvent(eventType);

  const chooseKind = (kind: AutomationTriggerKind) => {
    setValue('triggerKind', kind, { shouldDirty: true });
    if (getValues('localTime') === '') {
      setValue('localTime', DEFAULT_EVENT_TIME, { shouldDirty: true });
    }
  };

  const timeField = (
    <label className={FIELD_CLASS}>
      <span>{t('automations.drawer.when.at')}</span>
      <Input type="time" step={60} {...register('localTime')} aria-label={t('automations.drawer.when.at')} />
      <span className="text-meta font-normal text-muted-foreground">{t('automations.drawer.when.clientTime')}</span>
      <FieldError name="localTime" />
    </label>
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={isSchedule ? <Clock className="size-4" /> : <Flag className="size-4" />}>
        {t('automations.drawer.when.heading')}
      </SectionHeading>
      <div role="group" aria-label={t('automations.drawer.when.heading')} className="grid grid-cols-2 gap-2">
        <ChoiceButton
          selected={isSchedule}
          onClick={() => chooseKind(AutomationTriggerKind.Schedule)}
          icon={<Clock className="size-4" />}
        >
          {t('automations.drawer.when.schedule')}
        </ChoiceButton>
        <ChoiceButton
          selected={!isSchedule}
          onClick={() => chooseKind(AutomationTriggerKind.Event)}
          icon={<Flag className="size-4" />}
        >
          {t('automations.drawer.when.event')}
        </ChoiceButton>
      </div>

      {isSchedule ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <label className={FIELD_CLASS}>
              <span>{t('automations.drawer.when.every')}</span>
              <Input type="number" inputMode="numeric" min={1} max={365} {...register('scheduleInterval')} />
            </label>
            <label className={FIELD_CLASS}>
              <span>{t('automations.drawer.when.unit')}</span>
              <div className="relative">
                <select {...register('scheduleUnit')} className={SELECT_CLASS}>
                  <option value={AutomationScheduleUnit.Days}>{t('automations.drawer.when.days')}</option>
                  <option value={AutomationScheduleUnit.Weeks}>{t('automations.drawer.when.weeks')}</option>
                </select>
                <SelectChevron />
              </div>
            </label>
            {timeField}
          </div>
          <FieldError name="scheduleInterval" />
          <div className={FIELD_CLASS}>
            <span>{t('automations.drawer.when.starting')}</span>
            <p className="rounded-field border border-line bg-sunken px-3 py-2.5 text-copy font-normal text-ink-2">
              {t('automations.drawer.when.startingFixed')}
            </p>
          </div>
        </>
      ) : (
        <>
          <label className={FIELD_CLASS}>
            <span>{t('automations.drawer.when.eventLabel')}</span>
            <div className="relative">
              <select
                {...register('eventType', {
                  onChange: (event) => {
                    if (!isPlanEvent(event.target.value as AutomationEventType)) {
                      setValue('oncePerPlan', false, { shouldDirty: true });
                      setValue('eventOffsetDirection', AutomationOffsetDirection.After, { shouldDirty: true });
                    }
                  },
                })}
                className={SELECT_CLASS}
              >
                {EVENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`automations.events.${value}`)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className={FIELD_CLASS}>
              <span>{t('automations.drawer.when.timing')}</span>
              <Input type="number" inputMode="numeric" min={0} max={365} {...register('eventOffsetDays')} />
            </label>
            <label className={FIELD_CLASS}>
              <span>{t('automations.drawer.when.unit')}</span>
              <div className="relative">
                <select {...register('eventOffsetDirection')} className={SELECT_CLASS}>
                  <option value={AutomationOffsetDirection.After}>{t('automations.drawer.when.daysAfter')}</option>
                  {planEvent && (
                    <option value={AutomationOffsetDirection.Before}>{t('automations.drawer.when.daysBefore')}</option>
                  )}
                </select>
                <SelectChevron />
              </div>
            </label>
            {timeField}
          </div>
          <FieldError name="eventOffsetDays" />
        </>
      )}
    </section>
  );
}
