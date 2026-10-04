import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientIdentityBlock from '@/components/client-detail/ClientIdentityBlock';
import TbdValue from '@/components/client-detail/TbdValue';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
}

/**
 * Client-detail page header (#1094): back arrow, `ClientIdentityBlock`
 * (name, status pill, meta line, goal chip — extracted in #1095 so the
 * inbox's "Show client" panel can reuse it), and four action buttons.
 * Chat is live (#1095) — it navigates to `/inbox?client=<publicId>`, which
 * opens the existing thread with this client or starts one. Tasks/Notes/Info
 * still render disabled with the shell's coming-soon treatment: Tasks has
 * no backend concept at all (design review, 2026-09-21), and no Notes/Info
 * UI exists yet.
 */
export default function ClientDetailHeader({ dashboard }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <Link
          to="/clients"
          aria-label={t('clientDetail.overview.backAriaLabel')}
          className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <ClientIdentityBlock dashboard={dashboard} headingLevel="h1" />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/inbox?client=${dashboard.clientPublicId}`}>{t('clientDetail.overview.actions.chat')}</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')} className="gap-1.5">
          {t('clientDetail.overview.actions.tasks')}
          <TbdValue />
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.notes')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.info')}
        </Button>
      </div>
    </div>
  );
}
