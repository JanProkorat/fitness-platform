import type { ReactNode } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CatalogStatus } from '@/components/package-catalog/catalogFormat';

export const HEAD_CLASS = 'px-4 py-3.5 text-meta font-semibold';
export const CELL_CLASS = 'px-4 py-2.75';
export const CELL_TEXT_CLASS = `${CELL_CLASS} text-body text-ink-2`;

const STATUS_CLASS: Record<CatalogStatus, string> = {
  active: 'bg-success-soft text-success-ink',
  ended: 'bg-sunken text-ink-2',
  archived: 'bg-sunken text-ink-2',
};

export function StatusBadge({ status }: { status: CatalogStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-semibold',
        STATUS_CLASS[status],
      )}
    >
      {status === 'active' && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {t(`packages.status.${status}`)}
    </span>
  );
}

/** Rounded icon tile; the muted tone marks archived and ended rows. */
export function CatalogTile({ muted, children }: { muted: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl',
        muted ? 'bg-sunken text-ink-2' : 'bg-nutrition-soft text-nutrition-ink',
      )}
    >
      {children}
    </span>
  );
}

interface RowMenuProps {
  name: string;
  onEdit: () => void;
  onArchive: () => void;
}

/** Edit and archive actions of an active row. */
export function RowMenu({ name, onEdit, onArchive }: RowMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('packages.rowMenu.open', { name })}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}>{t('packages.rowMenu.edit')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onArchive}>
          {t('packages.rowMenu.archive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface StateRowsProps {
  columnCount: number;
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyKey: string;
  onRetry: () => void;
}

/** Skeleton, error and empty rows shared by both tables; renders nothing once there is data. */
export function StateRows({ columnCount, isPending, isError, isEmpty, emptyKey, onRetry }: StateRowsProps) {
  const { t } = useTranslation();
  if (isPending) {
    return Array.from({ length: 4 }).map((_, index) => (
      <TableRow key={index}>
        <TableCell colSpan={columnCount}>
          <Skeleton className="h-10 w-full" />
        </TableCell>
      </TableRow>
    ));
  }
  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="py-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <p className="text-body text-muted-foreground">{t('packages.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t('packages.retry')}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }
  if (isEmpty) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="py-10 text-center text-body text-muted-foreground">
          {t(emptyKey)}
        </TableCell>
      </TableRow>
    );
  }
  return null;
}
