import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { SeenMealItemKind } from '@/api/generated';
import type { EatenView } from '@/components/plan-editor/meal-locks';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';

interface Props {
  eaten: EatenView;
}

/** What the client ate of a meal, item by item: a tick for an eaten item, an empty ring for one left. Read-only. */
export default function EatenSnapshotList({ eaten }: Props) {
  const { t, i18n } = useTranslation();
  const ids = new Set(eaten.eatenItemIds);
  return (
    <ul className="flex flex-col gap-2.5">
      {eaten.snapshot.map((item, index) => {
        const isEaten = ids.size === 0 || (item.itemId !== undefined && ids.has(item.itemId));
        const amount = Math.round((item.amount ?? 0) * 10) / 10;
        return (
          <li key={`${item.itemId ?? ''}:${index}`} data-testid="eaten-item" data-eaten={isEaten} className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-copy font-semibold text-ink">{item.name}</span>
              <span className="text-meta text-muted-foreground">
                {t(item.kind === SeenMealItemKind.Recipe ? 'planEditor.locks.item.recipe' : 'planEditor.locks.item.food', { amount })}
              </span>
            </span>
            <span className="w-20 shrink-0 text-right text-copy font-semibold text-ink">
              {t('planEditor.cell.kcal', { kcal: formatKcal(item.kcal ?? 0, i18n.language) })}
            </span>
            {isEaten ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-card">
                <Check className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t('planEditor.locks.item.eaten')}</span>
              </span>
            ) : (
              <span
                role="img"
                aria-label={t('planEditor.locks.item.notEaten')}
                className="size-6 shrink-0 rounded-full border-2 border-line"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
