import { useTranslation } from 'react-i18next';
import { StoreLinks } from '@/components/home/MockupParts';

/** Page footer: copyright, and store links. */
export default function HomeFooter() {
  const { t } = useTranslation();

  return (
    <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-9 text-body text-muted-foreground sm:px-10 lg:px-16">
      <span>{t('home.footer.copyright', { year: new Date().getFullYear() })}</span>
      <span className="sm:ml-auto">{t('home.footer.getApp')}</span>
      <StoreLinks
        appStore={t('home.app.appStore')}
        googlePlay={t('home.app.googlePlay')}
        size="sm"
      />
    </footer>
  );
}
