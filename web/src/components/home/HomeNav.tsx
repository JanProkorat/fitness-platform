import { Link } from 'react-router-dom';
import { scrollToAnchor } from '@/components/home/smoothAnchor';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/entry/LanguageSwitcher';
import NavCompactMenu from '@/components/home/NavCompactMenu';
import ThemeToggle from '@/components/home/ThemeToggle';

const NAV_LINKS = [
  { id: 'how-it-works', key: 'howItWorks' },
  { id: 'for-coaches', key: 'forCoaches' },
  { id: 'for-nutritionists', key: 'forNutritionists' },
  { id: 'mobile-app', key: 'mobileApp' },
] as const;

/** DOM id of the nav Sign in link; the sign-in dialog returns focus here on close. */
export const SIGN_IN_LINK_ID = 'home-sign-in';

/** Top navigation of the public home page: wordmark, section anchors, sign in / create account. */
export default function HomeNav() {
  const { t } = useTranslation();

  return (
    <header className="flex h-19 items-center gap-4 px-4 sm:px-10 lg:gap-9 lg:px-16">
      <Link
        to="/"
        className="font-display text-home-wordmark-sm font-light tracking-wordmark-sm whitespace-nowrap text-ink sm:text-home-wordmark sm:tracking-wordmark"
      >
        {t('home.brand.form')} <span className="text-marker">{t('home.brand.up')}</span>
      </Link>
      <nav
        aria-label={t('home.nav.label')}
        className="ml-6 hidden gap-7 text-copy font-medium text-ink-2 lg:flex"
      >
        {NAV_LINKS.map((link) => (
          <a key={link.id} href={`#${link.id}`} onClick={scrollToAnchor} className="hover:text-ink">
            {t(`home.nav.${link.key}`)}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        <div className="sm:hidden">
          <NavCompactMenu />
        </div>
        <div className="hidden items-center gap-2.5 sm:flex">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <Link
          id={SIGN_IN_LINK_ID}
          to="/login"
          className="flex h-10 items-center rounded-field border border-border bg-surface px-3 text-body whitespace-nowrap sm:px-4 sm:text-copy font-semibold text-ink hover:bg-sunken"
        >
          {t('home.nav.signIn')}
        </Link>
        <Link
          to="/register"
          className="hidden h-10 items-center rounded-field bg-primary px-3 text-body whitespace-nowrap md:flex sm:px-4.5 sm:text-copy font-bold text-primary-foreground hover:opacity-90"
        >
          {t('home.nav.createAccount')}
        </Link>
      </div>
    </header>
  );
}
