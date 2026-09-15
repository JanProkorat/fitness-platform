import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * Closing call to action plus the page footer (spec §6 / prototype `.cta`
 * + `footer`). The prototype's `.protonote` block documents the prototype
 * itself ("this is the root URL /...") and is not user-facing production
 * copy — deliberately not ported here.
 */
export default function CtaSection() {
  const { t } = useTranslation();

  return (
    <section className="border-t border-line-soft py-12 sm:py-16 lg:py-19">
      <div className="mx-auto max-w-wrap px-6 sm:px-9 lg:px-18">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-pill p-8 sm:p-11 lg:p-13">
          <div>
            <h2 className="max-w-[22ch] text-cta-title font-bold text-paper">{t('entry.cta.title')}</h2>
            <p className="mt-2 max-w-[46ch] text-copy text-paper/60">{t('entry.cta.body')}</p>
          </div>
          <Button type="button" size="lg" className="w-auto">
            {t('entry.cta.button')}
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-wrap flex-wrap items-center justify-between gap-4 border-t border-line-soft px-6 pt-7 pb-10 text-meta text-muted-foreground sm:px-9 lg:px-18">
        <span>{t('entry.copyright')}</span>
        <span>{t('entry.footer')}</span>
      </div>
    </section>
  );
}
