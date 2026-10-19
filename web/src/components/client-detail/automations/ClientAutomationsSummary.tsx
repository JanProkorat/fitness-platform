import { useTranslation } from 'react-i18next';
import type { ClientAutomationSummary } from '@/api/automations';

interface Props {
  summary: ClientAutomationSummary | undefined;
  clientName: string;
}

/** "Sent to {name}": the four 30-day counters. */
export default function ClientAutomationsSummary({ summary, clientName }: Props) {
  const { t } = useTranslation();
  const counters = [
    { key: 'sent', value: summary?.sent ?? 0 },
    { key: 'answered', value: summary?.answered ?? 0 },
    { key: 'waiting', value: summary?.waiting ?? 0 },
    { key: 'skipped', value: summary?.skipped ?? 0 },
  ] as const;

  return (
    <section
      aria-label={t('clientDetail.automations.summary.title', { name: clientName })}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-5 shadow-panel"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-card-title font-bold text-ink">
          {t('clientDetail.automations.summary.title', { name: clientName })}
        </h3>
        <span className="text-body text-muted-foreground">{t('clientDetail.automations.summary.period')}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters.map(({ key, value }) => (
          <div key={key} className="flex flex-col-reverse gap-1 rounded-xl bg-sunken px-4 py-3.5">
            <dt className="text-body text-muted-foreground">{t(`clientDetail.automations.summary.${key}`)}</dt>
            <dd className="text-stat font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
