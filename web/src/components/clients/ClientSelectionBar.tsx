import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  onBroadcast: () => void;
  onCancel: () => void;
}

/**
 * The bulk-selection action bar. Visually a floating pill like a toast, but
 * NOT a toast: it persists exactly as long as `count > 0` (no auto-dismiss
 * timer) and carries interactive buttons rather than a queued string — see
 * PLAN-1066-clients-page.md §1 phase 1 for why this can't be routed through
 * `stores/toast.ts`. Reads selection state directly from its props; the
 * caller (ClientsPage) owns clearing the selection on tab switch.
 */
export default function ClientSelectionBar({ count, onBroadcast, onCancel }: Props) {
  const { t } = useTranslation();

  if (count === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-card-foreground shadow-panel">
      <span className="text-body font-medium">{t('clients.selectionBar.count', { count })}</span>
      <Button type="button" variant="default" size="sm" onClick={onBroadcast}>
        {t('clients.selectionBar.broadcast')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {t('clients.selectionBar.cancel')}
      </Button>
    </div>
  );
}
