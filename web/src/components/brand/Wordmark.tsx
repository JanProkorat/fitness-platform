import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import LogoMark from '@/components/brand/LogoMark';

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

/** The Form Up brand lockup: the checklist mark stands in for the "F" of FORM. */
export default function Wordmark({ size = 'nav', to, className }: Props) {
  const { t } = useTranslation();
  const classes = cn('font-display font-light whitespace-nowrap', SIZE_CLASSES[size], className);
  const content = (
    <>
      <span className="sr-only">{t('home.brand.name')}</span>
      <span aria-hidden="true">
        <LogoMark cropped className="mr-[0.22em] inline-block align-baseline h-[0.7em] w-[0.763em]" />
        {t('home.brand.form').slice(1)} <span className="text-marker">{t('home.brand.up')}</span>
      </span>
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
