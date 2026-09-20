import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Row count on the current page — drives whether the footer renders at all. */
  rowCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/**
 * Pagination footer for the Active/Paused/Archived tabs' table card. Pending
 * is unpaginated. Unlike the prior implementation, this renders whenever
 * there are rows to describe — even on a single page — because the Figma
 * wireframe (frame client-list-02, #1066 phase 6) always shows the "Viewing
 * X of Y" line as the card's footer, not just once pagination is needed.
 */
export default function ClientsPagination({ rowCount, page, pageSize, totalCount, onPageChange }: Props) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (rowCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-border p-5">
      <span className="text-caption text-muted-foreground">
        {t('clients.pagination.viewing', { count: rowCount, total: totalCount })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('common.previous')}
        </Button>
        <span className="flex size-7 items-center justify-center rounded-full bg-line text-body font-medium text-ink">
          {page}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.next')}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
