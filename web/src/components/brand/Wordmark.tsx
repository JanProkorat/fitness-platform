import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type WordmarkSize = 'nav' | 'sidebar';

interface Props {
  /** `nav` = public landing nav (responsive), `sidebar` = portal sidebar header. */
  size?: WordmarkSize;
  /** Renders the wordmark as a router link when set. */
  to?: string;
  className?: string;
}

const SIZE_CLASSES: Record<WordmarkSize, string> = {
  nav: 'text-home-wordmark-sm tracking-wordmark-sm text-ink sm:text-home-wordmark sm:tracking-wordmark',
  sidebar: 'text-card-title leading-none tracking-wordmark text-sidebar-text',
};

/** The FORM UP brand wordmark. */
export default function Wordmark({ size = 'nav', to, className }: Props) {
  const { t } = useTranslation();
  const classes = cn('font-display font-light whitespace-nowrap', SIZE_CLASSES[size], className);
  const content = (
    <>
      {t('home.brand.form')} <span className="text-marker">{t('home.brand.up')}</span>
    </>
  );

  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
