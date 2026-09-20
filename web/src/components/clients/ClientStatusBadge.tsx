import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ClientListStatus } from '@/api/generated';

interface Props {
  status?: ClientListStatus;
}

/**
 * Status badge for a clients-list row. Labels reuse the tab labels
 * (`clients.tabs.*`) rather than duplicating the same three words under a
 * second key — a client's status IS the tab it belongs to.
 */
export default function ClientStatusBadge({ status }: Props) {
  const { t } = useTranslation();

  switch (status) {
    case ClientListStatus.Paused:
      return <Badge variant="secondary">{t('clients.tabs.paused')}</Badge>;
    case ClientListStatus.Archived:
      return <Badge variant="outline">{t('clients.tabs.archived')}</Badge>;
    case ClientListStatus.Active:
    default:
      return <Badge variant="default">{t('clients.tabs.active')}</Badge>;
  }
}
