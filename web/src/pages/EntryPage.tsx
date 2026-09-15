import { useTranslation } from 'react-i18next';

/**
 * Public entry route ("/"). The real marketing + login page is epic
 * sub-issue 1 (see the design spec §6) — this placeholder exists only so
 * ProtectedRoute has a public target to redirect unauthenticated visitors
 * to, without an infinite redirect loop.
 */
export default function EntryPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-body text-ink">{t('common.redesignPlaceholder')}</p>
    </div>
  );
}
