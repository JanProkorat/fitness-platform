import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Props {
  /** The row's client public id. Empty when the row has no page to open (no publicId). */
  publicId: string;
  /** The collaboration ended: the detail page is gone, only the kept payments can still be opened. */
  ended?: boolean;
}

/**
 * Row-level actions menu. "Open client detail" links to `/clients/:clientId`
 * (#1094) — a real page now that the client-detail route exists. Falls back
 * to a disabled item for the (should-not-happen) case of a row with no
 * `publicId`, rather than linking to a broken route.
 */
export default function ClientRowMenu({ publicId, ended = false }: Props) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('clients.rowMenu.open')}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ended && publicId ? (
          <DropdownMenuItem asChild>
            <Link to={`/clients/${publicId}/payment`}>{t('clients.rowMenu.payments')}</Link>
          </DropdownMenuItem>
        ) : publicId ? (
          <DropdownMenuItem asChild>
            <Link to={`/clients/${publicId}`}>{t('clients.rowMenu.viewDetail')}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>{t('clients.rowMenu.viewDetail')}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
