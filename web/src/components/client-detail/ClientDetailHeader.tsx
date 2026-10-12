import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientIdentityBlock from '@/components/client-detail/ClientIdentityBlock';
import ClientAvatar from '@/components/clients/ClientAvatar';
import { getClientDetailBackPath } from '@/lib/clientDetailNavigation';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
}

/**
 * Client-detail page header (#1094): back arrow, `ClientIdentityBlock`
 * (name, status pill, meta line, goal chip), and four action buttons.
 * Chat is live (#1095) — it navigates to `/inbox?client=<publicId>`, which
 * opens the existing thread with this client or starts one. Tasks/Notes/Info
 * still render disabled with the shell's coming-soon treatment: Tasks has
 * no backend concept at all (design review, 2026-09-21), and no Notes/Info
 * UI exists yet.
 */
export default function ClientDetailHeader({ dashboard }: Props) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link
          to={getClientDetailBackPath(location.state)}
          aria-label={t('clientDetail.overview.backAriaLabel')}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <ClientAvatar
          firstName={dashboard.firstName}
          lastName={dashboard.lastName}
          className="size-14"
          fallbackClassName="bg-primary text-body font-semibold text-primary-foreground"
        />
        <ClientIdentityBlock dashboard={dashboard} />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link to={`/inbox?client=${dashboard.clientPublicId}`}>
            <MessageSquare className="size-4" aria-hidden="true" />
            {t('clientDetail.overview.actions.chat')}
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.tasks')}
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
