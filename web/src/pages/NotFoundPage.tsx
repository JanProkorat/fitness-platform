import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-title font-bold text-ink">{t('shell.notFoundTitle')}</h1>
      <p className="text-body text-muted-foreground">{t('shell.notFoundBody')}</p>
      <Link
        to="/clients"
        className="text-body font-medium text-primary underline-offset-4 hover:underline"
      >
        {t('shell.backToClients')}
      </Link>
    </div>
  );
}
