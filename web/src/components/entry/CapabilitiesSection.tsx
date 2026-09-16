import { useTranslation } from 'react-i18next';

/**
 * "What the platform does" marketing band — three capability cards
 * (spec §6 / prototype `.band` + `.grid3`).
 */
export default function CapabilitiesSection() {
  const { t } = useTranslation();

  const cards = [
    {
      key: 'nutrition',
      tag: t('entry.capabilities.nutrition.tag'),
      title: t('entry.capabilities.nutrition.title'),
      body: t('entry.capabilities.nutrition.body'),
    },
    {
      key: 'training',
      tag: t('entry.capabilities.training.tag'),
      title: t('entry.capabilities.training.title'),
      body: t('entry.capabilities.training.body'),
    },
    {
      key: 'contact',
      tag: t('entry.capabilities.contact.tag'),
      title: t('entry.capabilities.contact.title'),
      body: t('entry.capabilities.contact.body'),
    },
  ];

  return (
    <section className="min-w-0 border-t border-border py-12 sm:py-16 lg:py-19 panel:col-start-1">
      <div className="mx-auto max-w-wrap px-6 sm:px-9 lg:px-18">
        <div className="mb-9 max-w-[56ch]">
          <p className="text-label font-semibold tracking-label text-muted-foreground uppercase">
            {t('entry.capabilities.eyebrow')}
          </p>
          <h2 className="mt-2.5 mb-3 text-section-title font-bold text-ink">
            {t('entry.capabilities.title')}
          </h2>
          <p className="text-subhead text-muted-foreground">{t('entry.capabilities.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.key}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5.5 shadow-sm"
            >
              <span className="mb-1 self-start rounded-sm bg-green-soft px-2 py-0.75 text-label font-semibold tracking-[.1em] text-green-ink uppercase">
                {card.tag}
              </span>
              <h3 className="text-subhead font-semibold text-ink">{card.title}</h3>
              <p className="text-body text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
