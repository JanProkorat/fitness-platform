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
 * Pagination footer for a library table card (Ingredients, Recipes). Mirrors `ClientsPagination`
 * (`@/components/clients/ClientsPagination.tsx`) — renders whenever there are
 * rows to describe, even on a single page, since "Viewing X of Y" is the
 * card's footer regardless of page count.
 */
export default function Pagination({ rowCount, page, pageSize, totalCount, onPageChange }: Props) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (rowCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-4">
      <span className="text-body text-muted-foreground">
        {t('library.pagination.viewing', { count: rowCount, total: totalCount })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-semibold text-ink"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('common.previous')}
        </Button>
        <span className="flex size-7 items-center justify-center rounded-full bg-ink text-body font-semibold text-primary-foreground shadow-popover">
          {page}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-semibold text-ink"
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
