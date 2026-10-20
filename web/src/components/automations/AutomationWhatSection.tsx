import { useEffect, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Camera, FileText, Ruler, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { AutomationActionType } from '@/api/automations';
import { QuestionnaireType } from '@/api/questionnaires';
import { useTrainerQuestionnaires } from '@/hooks/useQuestionnaireQueries';
import {
  FIELD_CLASS,
  ChoiceButton,
  FieldError,
  SELECT_CLASS,
  SectionHeading,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import { messageLimitFor, type AutomationRuleFormValues } from '@/components/automations/automationRuleForm';

const ACTIONS = [
  { value: AutomationActionType.SendForm, icon: <FileText className="size-4" />, labelKey: 'sendForm' },
  { value: AutomationActionType.RequestProgressPhotos, icon: <Camera className="size-4" />, labelKey: 'requestPhotos' },
  { value: AutomationActionType.RequestMeasurements, icon: <Ruler className="size-4" />, labelKey: 'requestMeasurements' },
] as const;

interface Props {
  /** Override variant: the action belongs to the parent rule and cannot be changed. */
  actionLocked?: boolean;
  /** Editing a saved rule: the action tiles show the chosen action but cannot change it. */
  actionReadOnly?: boolean;
}

/** Section 2: the action, its form and the message. The message limit follows the action. */
export default function AutomationWhatSection({ actionLocked = false, actionReadOnly = false }: Props) {
  const { t } = useTranslation();
  const { register, setValue, trigger, control, getValues } = useFormContext<AutomationRuleFormValues>();
  const actionType = useWatch({ control, name: 'actionType' });
  const message = useWatch({ control, name: 'message' }) ?? '';
  const limit = messageLimitFor(actionType);
  // An automation can only send an active onboarding form; check-in forms have their own flow.
  const formsQuery = useTrainerQuestionnaires({ type: QuestionnaireType.Onboarding });
  const forms = useMemo(() => (formsQuery.data ?? []).filter((form) => form.isActive), [formsQuery.data]);
  const loadedForms = formsQuery.isSuccess && !formsQuery.isPlaceholderData ? forms : undefined;

  // A saved rule may point at a form that is no longer offered; clear it so the required-form check shows.
  useEffect(() => {
    if (!loadedForms || actionLocked || actionType !== AutomationActionType.SendForm) return;
    const current = getValues('questionnaireId');
    if (current !== '' && !loadedForms.some((form) => form.publicId === current)) {
      setValue('questionnaireId', '', { shouldDirty: true });
      void trigger('questionnaireId');
    }
  }, [loadedForms, actionLocked, actionType, getValues, setValue, trigger]);

  const chooseAction = (value: AutomationActionType) => {
    setValue('actionType', value, { shouldDirty: true });
    // The limit differs per action, so recheck the message already typed.
    void trigger('message');
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={<Send className="size-4" />}>{t('automations.drawer.what.heading')}</SectionHeading>
      {!actionLocked && (
        <div role="group" aria-label={t('automations.drawer.what.heading')} className="grid grid-cols-2 gap-2">
          {ACTIONS.map(({ value, icon, labelKey }) => (
            <ChoiceButton
              key={value}
              selected={actionType === value}
              disabled={actionReadOnly}
              onClick={() => chooseAction(value)}
              icon={icon}
            >
              {t(`automations.drawer.what.${labelKey}`)}
            </ChoiceButton>
          ))}
        </div>
      )}
      {!actionLocked && actionReadOnly && (
        <p className="text-meta font-normal text-muted-foreground">{t('automations.drawer.what.actionLockedHint')}</p>
      )}

      {actionType === AutomationActionType.SendForm && !actionLocked && (
        <label className={FIELD_CLASS}>
          <span>{t('automations.drawer.what.form')}</span>
          <div className="relative">
            <select {...register('questionnaireId')} className={SELECT_CLASS}>
              <option value="">{t('automations.drawer.what.formPlaceholder')}</option>
              {forms.map((form) => (
                <option key={form.publicId} value={form.publicId}>
                  {t('automations.drawer.what.formOption', { title: form.title, count: form.questionCount })}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          {formsQuery.isError && (
            <span className="text-meta font-normal text-destructive">{t('automations.drawer.what.formsError')}</span>
          )}
          <FieldError name="questionnaireId" />
        </label>
      )}

      <label className={FIELD_CLASS}>
        <span>{t('automations.drawer.what.message')}</span>
        <Textarea {...register('message')} rows={3} className="min-h-21 resize-none leading-normal" />
        <span className="flex items-start justify-between gap-2">
          <FieldError name="message" />
          <span className="ml-auto text-meta font-normal text-muted-foreground">
            {t('automations.drawer.what.counter', { current: message.length, max: limit })}
          </span>
        </span>
      </label>
    </section>
  );
}
