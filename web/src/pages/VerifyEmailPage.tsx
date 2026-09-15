import { useTranslation } from 'react-i18next';

/**
 * Public "/verify-email" placeholder. ProtectedRoute redirects here for an
 * authenticated user whose email is unconfirmed. Built out properly in the
 * register/verify sub-issue (design spec §5, page 2).
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="text-title font-bold text-ink">{t('auth.verifyEmailTitle')}</h1>
      <p className="text-body text-muted-foreground">{t('auth.verifyEmailSubtitle')}</p>
    </div>
  );
}
