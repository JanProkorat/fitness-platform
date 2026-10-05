import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NAV_LINKS = [
  { id: 'how-it-works', key: 'howItWorks' },
  { id: 'for-coaches', key: 'forCoaches' },
  { id: 'for-nutritionists', key: 'forNutritionists' },
  { id: 'mobile-app', key: 'mobileApp' },
] as const;

const FOCUS_POLL_MS = 50;
const FOCUS_MAX_ATTEMPTS = 30;

/**
 * Brings the sign-in form into view and focuses Email. When the panel is
 * still showing another form (a route swap is mid-flight) the login field
 * does not exist yet, so this polls briefly instead of focusing the
 * outgoing form's field.
 */
function revealSignIn(attempt = 0) {
  const panel = document.getElementById('sign-in');
  const email = document.getElementById('entry-email');

  if (panel && email) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    email.focus({ preventScroll: true });
    return;
  }

  if (attempt < FOCUS_MAX_ATTEMPTS) {
    window.setTimeout(() => revealSignIn(attempt + 1), FOCUS_POLL_MS);
  }
}

/** Top navigation of the public home page: wordmark, section anchors, sign in / create account. */
export default function HomeNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignIn = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (location.pathname !== '/') {
      navigate('/');
    }
    revealSignIn();
  };

  return (
    <header className="flex h-19 items-center gap-4 px-4 sm:px-10 panel:gap-9 panel:px-16">
      <Link
        to="/"
        className="font-display text-[20px] leading-none font-light tracking-[0.22em] whitespace-nowrap text-ink"
      >
        {t('home.brand.form')} <span className="text-marker">{t('home.brand.up')}</span>
      </Link>
      <nav
        aria-label={t('home.nav.label')}
        className="ml-6 hidden gap-7 text-copy font-medium text-ink-2 lg:flex"
      >
        {NAV_LINKS.map((link) => (
          <a key={link.id} href={`#${link.id}`} className="hover:text-ink">
            {t(`home.nav.${link.key}`)}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2.5">
        <a
          href="/#sign-in"
          onClick={handleSignIn}
          className="flex h-10 items-center rounded-field border border-border bg-surface px-4 text-copy font-semibold text-ink hover:bg-sunken"
        >
          {t('home.nav.signIn')}
        </a>
        <Link
          to="/register"
          className="flex h-10 items-center rounded-field bg-primary px-4.5 text-copy font-bold text-primary-foreground hover:opacity-90"
        >
          {t('home.nav.createAccount')}
        </Link>
      </div>
    </header>
  );
}
