import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  templateName: string;
  /** Delete is offered to the owner only. */
  canDelete: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

/** Row-level actions: open, copy, and (owner only) delete. */
export default function PlanTemplateRowMenu({ templateName, canDelete, onOpen, onCopy, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('planTemplates.rowMenu.open', { name: templateName })}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={onOpen}>{t('planTemplates.rowMenu.openTemplate')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopy}>{t('planTemplates.rowMenu.copy')}</DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              {t('planTemplates.rowMenu.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
