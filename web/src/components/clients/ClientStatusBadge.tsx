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
 *
 * Active uses the "success" variant (soft green fill, dark green text) per
 * the Figma wireframe (frame client-list-02, #1066 phase 6). Paused/Archived
 * colors are NOT confirmed against a wireframe frame — the provided frames
 * only show Active-status rows — so they keep their pre-existing variants
 * rather than guessing at unconfirmed hex values.
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
      return <Badge variant="success">{t('clients.tabs.active')}</Badge>;
  }
}
