import { useTranslation } from 'react-i18next';

/**
 * Public "/download-app" placeholder. ProtectedRoute redirects here for a
 * client-only user, since clients use the mobile app rather than the web
 * portal.
 */
export default function DownloadAppPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="text-title font-bold text-ink">{t('downloadApp.title')}</h1>
      <p className="text-body text-muted-foreground">{t('downloadApp.subtitle')}</p>
      <p className="text-body text-muted-foreground">{t('downloadApp.comingSoon')}</p>
    </div>
  );
}
