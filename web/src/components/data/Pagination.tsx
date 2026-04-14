import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, totalCount, onPageChange, className = '' }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span className="text-xs text-text3">
        {t('common.page', { current: page, total: totalPages })} &middot;{' '}
        {t('common.total', { count: totalCount })}
      </span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          &larr; {t('common.previous')}
        </Button>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t('common.next')} &rarr;
        </Button>
      </div>
    </div>
  );
}
