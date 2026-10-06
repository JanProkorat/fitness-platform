import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';

/**
 * Public "/download-app" placeholder. ProtectedRoute redirects here for a
 * client-only user, since clients use the mobile app rather than the web
 * portal. The signed-in user gets a logout control so this page is never a
 * dead end.
 */
export default function DownloadAppPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="text-title font-bold text-ink">{t('downloadApp.title')}</h1>
      <p className="text-body text-muted-foreground">{t('downloadApp.subtitle')}</p>
      <p className="text-body text-muted-foreground">{t('downloadApp.comingSoon')}</p>
      {isAuthenticated && (
        <Button type="button" variant="outline" className="mt-4" onClick={handleLogout}>
          {t('auth.logout')}
        </Button>
      )}
    </div>
  );
}
