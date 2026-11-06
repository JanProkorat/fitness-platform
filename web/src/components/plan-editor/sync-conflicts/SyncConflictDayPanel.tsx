import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EatenView } from '@/components/plan-editor/meal-locks';
import { MacroBar } from '@/components/plan-editor/MealTileFace';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import { ConflictChip } from '@/components/plan-editor/sync-conflicts/ConflictComparison';
import MarkReviewedButton from '@/components/plan-editor/sync-conflicts/MarkReviewedButton';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { useConflictFacts } from '@/components/plan-editor/sync-conflicts/useConflictFacts';

interface Props {
  placed: PlacedConflict;
  model: SyncConflictsModel;
  eaten: EatenView | undefined;
}

/**
 * The notice inside a conflicted meal's card. The card itself shows what the client ate; this lists the coach's
 * plan items next to it, each tagged, and "Mark reviewed" only dismisses the notice.
 */
export default function SyncConflictDayPanel({ placed, model, eaten }: Props) {
  const { t, i18n } = useTranslation();
  const facts = useConflictFacts(placed, model, eaten);
  const client = model.clientName;
  const comparison = facts.comparison;

  return (
    <div
      data-testid="sync-conflict-panel"
      data-conflict-id={placed.id}
      className="flex flex-col gap-3 rounded-xl border border-caution-ink/40 bg-caution-soft p-3"
      // The card is a button-like row (select on click); the panel must not toggle it.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-3">
        <History className="size-4 shrink-0 text-caution-ink" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-body text-caution-ink">
          <b className="font-semibold">{t('planEditor.syncConflicts.day.lead', { client })}</b>{' '}
          {t('planEditor.syncConflicts.day.body', { client })}
        </p>
        <MarkReviewedButton conflictId={placed.id} model={model} />
      </div>
      {comparison ? (
        <div className="flex flex-col gap-2">
          <span className="text-label font-bold tracking-label text-caution-ink uppercase">
            {t('planEditor.syncConflicts.planNow')}
            {facts.nowVersion !== undefined && ` · ${t('planEditor.syncConflicts.version', { version: facts.nowVersion })}`}
            {` · ${t('planEditor.syncConflicts.notApplied')}`}
          </span>
          <ul data-testid="conflict-plan-rows" className="flex flex-col gap-2">
            {comparison.planRows.map((row) => (
              <li key={row.key} data-status={row.status} className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    data-testid="conflict-item-name"
                    className={cn(
                      'text-copy font-semibold text-ink [overflow-wrap:anywhere]',
                      row.status === 'removed' && 'line-through',
                    )}
                  >
                    {row.line.name}
                  </span>
                  {row.status !== 'same' && <ConflictChip status={row.status} />}
                </span>
                <span
                  data-testid="conflict-item-amount"
                  className={cn(
                    'w-24 shrink-0 text-right text-copy text-ink',
                    row.status === 'changed' && 'font-semibold text-caution-ink',
                  )}
                >
                  {t(`planEditor.syncConflicts.amount.${row.line.unit}`, {
                    amount: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(row.line.amount),
                  })}
                </span>
                <span className="w-20 shrink-0 text-right text-copy font-semibold text-ink">
                  {t('planEditor.cell.kcal', { kcal: formatKcal(row.line.kcal, i18n.language) })}
                </span>
                <span className="hidden w-40 shrink-0 xl:block">
                  <MacroBar totals={row.line.totals} />
                </span>
              </li>
            ))}
          </ul>
          <p data-testid="conflict-totals" className="text-body text-ink">
            {t('planEditor.syncConflicts.day.totals', {
              plan: formatKcal(comparison.nowKcal, i18n.language),
              client,
              eaten: formatKcal(comparison.sawKcal, i18n.language),
            })}
          </p>
        </div>
      ) : (
        <p className="text-body text-caution-ink">
          {t('planEditor.syncConflicts.textOnly', {
            client,
            based: facts.sawVersion ?? '–',
            current: facts.nowVersion ?? '–',
          })}
        </p>
      )}
    </div>
  );
}
