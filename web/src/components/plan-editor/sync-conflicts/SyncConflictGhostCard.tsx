import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import MarkReviewedButton from '@/components/plan-editor/sync-conflicts/MarkReviewedButton';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { useConflictFacts } from '@/components/plan-editor/sync-conflicts/useConflictFacts';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';

interface Props {
  placed: PlacedConflict;
  model: SyncConflictsModel;
}

/** The day view's card for a meal the coach removed after the client ate it offline. */
export default function SyncConflictGhostCard({ placed, model }: Props) {
  const { t, i18n } = useTranslation();
  const facts = useConflictFacts(placed, model);
  const client = model.clientName;
  const items = placed.conflict.seenItems ?? [];

  return (
    <li
      data-testid="sync-conflict-ghost-card"
      data-conflict-id={placed.id}
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-caution-ink/60 bg-muted p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-card-title font-semibold text-ink">{facts.meal}</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-caution-soft px-2.5 py-1 text-meta font-semibold text-caution-ink">
          <History className="size-3.5" aria-hidden="true" />
          {t('planEditor.syncConflicts.ghost.badge')}
        </span>
        <span className="ml-auto">
          <MarkReviewedButton conflictId={placed.id} model={model} />
        </span>
      </div>
      <p className="text-body text-ink">
        {t('planEditor.syncConflicts.ghost.body', { meal: facts.meal, client, date: facts.date, time: facts.time })}
      </p>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={`${item.refId ?? ''}:${index}`} className="flex items-baseline justify-between gap-3 text-copy text-muted-foreground">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="font-semibold line-through">{item.name}</span>{' '}
                <span className="text-body">
                  {t(`planEditor.syncConflicts.amount.${item.kind === 'Recipe' ? 'servings' : 'grams'}`, {
                    amount: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(item.amount ?? 0),
                  })}
                </span>
              </span>
              <span className="shrink-0 text-body">
                {t('planEditor.cell.kcal', { kcal: formatKcal(item.kcal ?? 0, i18n.language) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-muted-foreground">
          {t('planEditor.syncConflicts.textOnly', {
            client,
            based: facts.sawVersion ?? '–',
            current: facts.nowVersion ?? '–',
          })}
        </p>
      )}
    </li>
  );
}
