import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function DownloadAppPage() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.05), transparent 60%)',
      }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <LanguageSwitcher />
        {user && (
          <button
            onClick={logout}
            className="text-xs text-muted transition-colors hover:text-text"
          >
            {t('auth.logout')}
          </button>
        )}
      </div>

      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <span className="font-heading text-2xl font-black uppercase tracking-[3px] text-gold">
            GF
          </span>
          <span className="font-heading text-2xl font-normal uppercase tracking-wide text-text2">
            {' '}
            Platform
          </span>
        </div>

        {/* Card */}
        <div className="rounded-sm border border-border bg-surface p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm border border-gold/20 bg-gold/8 text-3xl">
            &#x1F4F1;
          </div>

          <h1 className="mb-2 text-2xl font-bold">
            {t('downloadApp.title')}
          </h1>
          <p className="mb-2 text-sm text-gold">
            {t('downloadApp.subtitle')}
          </p>
          <p className="mb-8 text-sm text-muted">
            {t('downloadApp.description')}
          </p>

          {/* Coming soon notice */}
          <div className="mb-6 rounded-sm border border-gold-dim/30 bg-gold/5 px-5 py-4">
            <p className="text-sm font-semibold text-gold">
              {t('downloadApp.comingSoon')}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t('downloadApp.comingSoonHint')}
            </p>
          </div>

          {/* Store buttons (disabled/placeholder until app is published) */}
          <div className="flex flex-col gap-3">
            <button
              disabled
              className="flex w-full items-center justify-center gap-3 rounded-sm bg-white/10 px-6 py-4 text-sm font-semibold text-text2 opacity-40"
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="currentColor">
                <path d="M16.52 12.26c-.03-3.19 2.6-4.72 2.72-4.8-1.48-2.16-3.79-2.46-4.61-2.5-1.96-.2-3.83 1.16-4.83 1.16-.99 0-2.53-1.13-4.16-1.1-2.14.03-4.11 1.25-5.21 3.17-2.23 3.86-.57 9.57 1.6 12.7 1.06 1.53 2.32 3.26 3.98 3.2 1.6-.06 2.2-1.03 4.13-1.03 1.93 0 2.48 1.03 4.17.99 1.72-.03 2.8-1.56 3.85-3.1 1.21-1.78 1.71-3.5 1.74-3.59-.04-.02-3.34-1.28-3.38-5.1z" />
                <path d="M13.38 3.36c.88-1.07 1.47-2.55 1.31-4.03-1.26.05-2.79.84-3.7 1.91-.81.94-1.52 2.44-1.33 3.88 1.41.11 2.85-.72 3.72-1.76z" />
              </svg>
              {t('downloadApp.appStore')}
            </button>

            <button
              disabled
              className="flex w-full items-center justify-center gap-3 rounded-sm bg-white/10 px-6 py-4 text-sm font-semibold text-text2 opacity-40"
            >
              <svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor">
                <path d="M1.05.52C.74.84.56 1.34.56 1.99v18.02c0 .65.18 1.15.49 1.47l.08.07L11.6 11.08v-.16L1.13.45 1.05.52zm3.44 3.44L.98 20.49l.08.07 3.43-3.44L14.96 11 4.49 3.96zm10.47 6.96l-3.36 3.37 3.36 3.37.08-.04 3.99-2.27c1.14-.65 1.14-1.71 0-2.35l-3.99-2.27-.08.19zm-3.36-3.37L14.96 11l3.07-3.07-3.99-2.27c-.57-.32-1.07-.33-1.47-.1l-.07.04L8.24 8.55l3.36 3z" />
              </svg>
              {t('downloadApp.googlePlay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
