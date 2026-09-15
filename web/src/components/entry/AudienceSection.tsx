import { useTranslation } from 'react-i18next';

/**
 * "For coaches / for clients" duo panels (spec §6 / prototype `.duo`).
 */
export default function AudienceSection() {
  const { t } = useTranslation();

  const panels = [
    {
      key: 'coaches',
      lead: true,
      eyebrow: t('entry.audience.coaches.eyebrow'),
      title: t('entry.audience.coaches.title'),
      subtitle: t('entry.audience.coaches.subtitle'),
      checks: [
        t('entry.audience.coaches.check1'),
        t('entry.audience.coaches.check2'),
        t('entry.audience.coaches.check3'),
        t('entry.audience.coaches.check4'),
      ],
    },
    {
      key: 'clients',
      lead: false,
      eyebrow: t('entry.audience.clients.eyebrow'),
      title: t('entry.audience.clients.title'),
      subtitle: t('entry.audience.clients.subtitle'),
      checks: [
        t('entry.audience.clients.check1'),
        t('entry.audience.clients.check2'),
        t('entry.audience.clients.check3'),
        t('entry.audience.clients.check4'),
      ],
    },
  ];

  return (
    <section className="border-t border-line-soft py-12 sm:py-16 lg:py-19">
      <div className="mx-auto max-w-wrap px-6 sm:px-9 lg:px-18">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {panels.map((panel) => (
            <div
              key={panel.key}
              className={
                'flex flex-col gap-3.5 rounded-2xl border border-border p-6.5 ' +
                (panel.lead ? 'bg-sunken' : '')
              }
            >
              <p className="text-label font-semibold tracking-[.14em] text-muted-foreground uppercase">
                {panel.eyebrow}
              </p>
              <h3 className="text-panel-title font-bold text-ink">{panel.title}</h3>
              <p className="text-copy text-ink-2">{panel.subtitle}</p>
              <ul className="flex flex-col gap-2.25">
                {panel.checks.map((check) => (
                  <li key={check} className="flex items-start gap-2.5 text-body text-ink-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-soft text-tick font-bold text-green-ink">
                      ✓
                    </span>
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
