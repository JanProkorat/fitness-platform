import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/**
 * Row-level actions menu. "Open client detail" ships disabled-only — no
 * `Link`, no `to`/`href`, no `onSelect` — because page 4 (client detail)
 * does not exist yet and `App.tsx` is deliberately out of scope for this
 * issue, so a live link would fall through to NotFoundPage. Radix sets
 * `aria-disabled` and swallows selection on a disabled Item; the `title`
 * attribute gives a "not yet" hint on hover rather than a bare-looking
 * disabled row.
 */
export default function ClientRowMenu() {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('clients.rowMenu.open')}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled title={t('clients.comingSoon')}>
          {t('clients.rowMenu.viewDetail')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
