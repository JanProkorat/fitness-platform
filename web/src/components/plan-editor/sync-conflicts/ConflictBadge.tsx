import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The small clock mark on a week tab, a day header or a tile that has an unreviewed conflict. */
export default function ConflictBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="sync-conflict-badge"
      role="img"
      aria-label={t('planEditor.syncConflicts.badge')}
      title={t('planEditor.syncConflicts.badge')}
      className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-caution-soft text-caution-ink', className)}
    >
      <History className="size-2.5" aria-hidden="true" />
    </span>
  );
}
