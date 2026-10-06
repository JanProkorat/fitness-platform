import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ClientListStatus } from '@/api/generated';
import { cn } from '@/lib/utils';

interface Props {
  status?: ClientListStatus;
}

/**
 * Status pill for a clients-list row: neutral outline pill, an ink dot for
 * Active and a grey dot for Paused/Archived (PageClients board). Labels reuse
 * the tab labels (`clients.tabs.*`) rather than duplicating the same words
 * under a second key — a client's status IS the tab it belongs to.
 */
export default function ClientStatusBadge({ status }: Props) {
  const { t } = useTranslation();

  const label =
    status === ClientListStatus.Active
      ? t('clients.tabs.active')
      : status === ClientListStatus.Paused
        ? t('clients.tabs.paused')
        : status === ClientListStatus.Archived
          ? t('clients.tabs.archived')
          : null;

  if (label === null) {
    return null;
  }

  const isActive = status === ClientListStatus.Active;

  return (
    <Badge variant="outline" className={cn('gap-1.5 px-2.25 py-0.75 text-meta font-semibold', !isActive && 'text-ink-2')}>
      <span
        className={cn('size-1.5 rounded-full', isActive ? 'bg-ink' : 'bg-muted-foreground')}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}
