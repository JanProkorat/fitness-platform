import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  clientId: string;
}

/** Points to the Automations tab, where payment requests and reminders are scheduled. */
export default function RequestsRemindersCard({ clientId }: Props) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('payments.client.reminders.title')}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-panel"
    >
      <div className="flex items-center gap-2.5">
        <h3 className="text-copy font-semibold text-ink">{t('payments.client.reminders.title')}</h3>
        <Link
          to={`/clients/${clientId}/automations`}
          className="ml-auto rounded-sm text-body font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('payments.client.reminders.link')}
        </Link>
      </div>
      <p className="text-body text-muted-foreground">{t('payments.client.reminders.body')}</p>
    </section>
  );
}
