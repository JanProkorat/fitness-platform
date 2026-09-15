import { useTranslation } from 'react-i18next';

/**
 * Marketing hero — brand mark, eyebrow, headline with one accent word,
 * sub-headline, capability chips, and the photo-collage placeholder
 * (spec §6 / prototype `.hero`). Photography does not exist yet; the
 * collage cells stay as styled placeholders per the issue notes.
 */
export default function HeroSection() {
  const { t } = useTranslation();

  const collageCells = [
    t('entry.collage.strength'),
    t('entry.collage.conditioning'),
    t('entry.collage.nutrition'),
    t('entry.collage.coaching'),
    t('entry.collage.progress'),
  ];

  const points = [
    t('entry.points.meals'),
    t('entry.points.training'),
    t('entry.points.checkins'),
    t('entry.points.chat'),
  ];

  return (
    <div className="relative flex min-h-0 flex-col justify-start gap-8 overflow-hidden bg-background px-6 pt-11 pb-12 sm:px-9 lg:px-18 panel:min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_90%_at_8%_0%,var(--color-green-soft)_0%,transparent_55%)]"
      />

      <div className="relative flex items-center gap-2.5 text-body font-semibold text-ink">
        <span className="flex size-7.5 items-center justify-center rounded-md bg-brand text-caption font-bold tracking-wide text-paper">
          {t('entry.brandMark')}
        </span>
        <span>{t('entry.brand')}</span>
      </div>

      <div className="relative max-w-hero-content">
        <p className="text-label font-semibold tracking-label text-muted-foreground uppercase">
          {t('entry.eyebrow')}
        </p>
        <h1 className="mt-4 mb-4.5 max-w-[12em] text-hero leading-[1.04] font-bold tracking-[-.02em] text-ink">
          <span>{t('entry.headline.line1')}</span>
          <br />
          <span className="font-accent text-[1.06em] font-semibold tracking-[-.01em] text-brand italic">
            {t('entry.headline.accent')}
          </span>
        </h1>
        <p className="max-w-[32em] text-lede leading-[1.6] text-ink-2">{t('entry.sub')}</p>
        <ul className="mt-6.5 flex flex-wrap gap-2">
          {points.map((point) => (
            <li
              key={point}
              className="inline-flex items-center gap-1.75 rounded-full border border-border bg-surface px-3 py-1.5 text-meta font-medium text-ink-2"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative max-w-hero-content">
        <div className="grid grid-cols-6 grid-rows-2 gap-2">
          {collageCells.map((label, index) => (
            <div
              key={label}
              className={
                'flex min-h-collage-cell items-end overflow-hidden rounded-2xl border border-dashed border-brand/35 bg-sunken p-2.5 ' +
                (index < 2 ? 'col-span-3' : 'col-span-2')
              }
            >
              <span className="text-label font-semibold tracking-[.12em] text-muted-foreground uppercase">
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-caption text-faint">{t('entry.collage.note')}</p>
      </div>
    </div>
  );
}
