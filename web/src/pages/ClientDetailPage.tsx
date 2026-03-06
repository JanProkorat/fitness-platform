import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-4">
        <Link
          to="/clients"
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          &larr; {t('clients.backToClients')}
        </Link>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-lg font-bold">{t('clients.clientDetail')}</h1>
          <p className="font-mono text-xs text-muted">{id}</p>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-center py-24 text-text3">
          <span className="text-5xl">&#x1F3CB;&#xFE0F;</span>
          <p className="mt-4 text-sm font-semibold">{t('clients.comingSoon')}</p>
          <p className="mt-1 text-xs text-muted">
            {t('clients.comingSoonHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
