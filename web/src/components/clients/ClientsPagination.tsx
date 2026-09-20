import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/** Pagination footer for the Active/Paused/Archived tabs. Pending is unpaginated. */
export default function ClientsPagination({ page, pageSize, totalCount, onPageChange }: Props) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-caption text-muted-foreground">{t('common.total', { count: totalCount })}</span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('common.previous')}
        </Button>
        <span className="text-caption text-muted-foreground">
          {t('common.page', { current: page, total: totalPages })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
