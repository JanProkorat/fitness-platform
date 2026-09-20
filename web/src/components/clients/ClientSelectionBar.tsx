import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  count: number;
  onBroadcast: () => void;
  onCancel: () => void;
}

const ACTION_PILL_CLASSES =
  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-body font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The bulk-selection action bar. Visually a floating pill like a toast, but
 * NOT a toast: it persists exactly as long as `count > 0` (no auto-dismiss
 * timer) and carries interactive buttons rather than a queued string — see
 * PLAN-1066-clients-page.md §1 phase 1 for why this can't be routed through
 * `stores/toast.ts`. Reads selection state directly from its props; the
 * caller (ClientsPage) owns clearing the selection on tab switch.
 *
 * Treatment matches Figma node 1:827 (frame client-list-02, #1079): a
 * divider between the count and the actions group, an outlined round pill
 * for Broadcast (with a leading icon), and a filled round pill for Cancel.
 * The wireframe also shows Retry Charging and Assign Automation actions,
 * but only Broadcast ships in v1 (scope settled in #1066, unchanged here).
 */
export default function ClientSelectionBar({ count, onBroadcast, onCancel }: Props) {
  const { t } = useTranslation();

  if (count === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-line bg-surface px-6 py-3 shadow-selection-bar">
      <span className="text-body font-semibold text-ink">{t('clients.selectionBar.count', { count })}</span>
      <div className="h-4 w-px bg-line" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(ACTION_PILL_CLASSES, 'border border-line bg-transparent text-muted-foreground')}
          onClick={onBroadcast}
        >
          <MessageSquare className="size-3.5" aria-hidden="true" />
          {t('clients.selectionBar.broadcast')}
        </button>
        <button
          type="button"
          className={cn(ACTION_PILL_CLASSES, 'border border-transparent bg-line text-ink-3')}
          onClick={onCancel}
        >
          {t('clients.selectionBar.cancel')}
        </button>
      </div>
    </div>
  );
}
