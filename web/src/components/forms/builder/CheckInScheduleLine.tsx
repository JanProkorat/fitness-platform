import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { isCheckInRule, shortTime, weekdayEvery } from '@/components/automations/automationFormat';
import { useAutomationRules } from '@/hooks/useAutomationQueries';

interface Props {
  /** Public id of the check-in form being edited; only the enabled rule that sends this form counts. */
  formId: string;
}

const LINK_CLASS = 'font-semibold text-ink underline underline-offset-2';

/** The form page's schedule line: when the check-in goes out, read from the check-in rule in Automations. */
export default function CheckInScheduleLine({ formId }: Props) {
  const { t } = useTranslation();
  const rulesQuery = useAutomationRules();

  if (!rulesQuery.isSuccess) {
    return null;
  }

  const rule = rulesQuery.data.rules.find(
    (candidate) => isCheckInRule(candidate) && candidate.enabled === true && candidate.questionnaireId === formId,
  );

  if (!rule?.scheduleWeekday) {
    return (
      <span data-testid="check-in-schedule-line">
        {t('forms.builder.info.checkInNotSent')}
        <span aria-hidden="true"> · </span>
        <Link to="/automations" className={LINK_CLASS}>
          {t('forms.builder.info.checkInSetUp')}
        </Link>
      </span>
    );
  }

  return (
    <span data-testid="check-in-schedule-line">
      <Trans
        i18nKey="forms.builder.info.checkInSent"
        values={{ day: weekdayEvery(rule.scheduleWeekday, t), time: shortTime(rule.localTime) }}
        components={{ strong: <strong className="font-bold text-ink" /> }}
      />
      {rule.reminderAfterHours != null && (
        <>
          <span aria-hidden="true"> · </span>
          {t('forms.builder.info.checkInReminder', { hours: rule.reminderAfterHours })}
        </>
      )}
      <span aria-hidden="true"> · </span>
      <Link to="/automations" className={LINK_CLASS}>
        {t('forms.builder.info.checkInEdit')}
      </Link>
    </span>
  );
}
