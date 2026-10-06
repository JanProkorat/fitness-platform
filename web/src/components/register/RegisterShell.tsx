import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface RegisterShellProps {
  children: ReactNode;
  /** Hide the "Already have an account? Sign in" link (the get-the-app page has no portal link). */
  showSignIn?: boolean;
}

/**
 * Full-page frame of the register flow: the glow-wash background shared with
 * the home hero, the wordmark and the "Already have an account? Sign in"
 * header. Sign in goes to /login, which opens the landing page's dialog.
 */
export default function RegisterShell({ children, showSignIn = true }: RegisterShellProps) {
  const { t } = useTranslation();

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-background text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 register-page-wash"
      />
      <header className="flex h-19 items-center short:h-13 gap-4 px-4 sm:px-10 lg:px-16">
        <Link
          to="/"
          className="font-display text-home-wordmark-sm font-light tracking-wordmark-sm whitespace-nowrap text-ink sm:text-home-wordmark sm:tracking-wordmark"
        >
          {t('home.brand.form')} <span className="text-marker">{t('home.brand.up')}</span>
        </Link>
        {showSignIn && (
          <p className="ml-auto text-right text-meta text-muted-foreground sm:text-copy">
            {t('entry.register.haveAccount')}{' '}
            <Link to="/login" className="font-bold text-ink underline underline-offset-2">
              {t('entry.register.signIn')}
            </Link>
          </p>
        )}
      </header>
      {children}
    </div>
  );
}
