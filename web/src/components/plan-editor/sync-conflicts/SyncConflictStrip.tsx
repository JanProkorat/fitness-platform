import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCalendarDate } from '@/components/client-plan-editor/clientPlanDates';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';

const DETAIL_LIMIT = 3;

interface Props {
  model: SyncConflictsModel;
  /** Takes the editor to the conflict and opens it. */
  onShow: (placed: PlacedConflict) => void;
}

/** The amber strip above the plan: how many offline meals collided with it, "Show" and "Mark all reviewed". */
export default function SyncConflictStrip({ model, onShow }: Props) {
  const { t, i18n } = useTranslation();
  if (model.placed.length === 0) {
    return null;
  }
  const first = model.placed.find((item) => item.weekIndex !== null);
  const detail = model.placed
    .slice(0, DETAIL_LIMIT)
    .map(({ conflict, ghost }) => {
      const meal = conflict.mealKind ? t(`planEditor.rows.${mealKindLabelKey(conflict.mealKind)}`) : '';
      const date = conflict.logDate ? formatCalendarDate(conflict.logDate.slice(0, 10), i18n.language) : '';
      const what = t(`planEditor.syncConflicts.strip.${ghost || conflict.kind === 'MealRemoved' ? 'removed' : 'changed'}`, { meal });
      return date ? `${date} · ${what}` : what;
    })
    .join('; ');

  return (
    <div
      role="status"
      data-testid="sync-conflict-strip"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-caution-ink/40 bg-caution-soft px-4 py-3 text-body text-caution-ink"
    >
      <History className="size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <b className="font-semibold">
          {t('planEditor.syncConflicts.strip.lead', { count: model.placed.length, client: model.clientName })}
        </b>{' '}
        {detail}
        {model.placed.length > DETAIL_LIMIT && '…'}
      </p>
      {first && (
        <Button type="button" variant="outline" size="sm" data-testid="sync-conflict-show" onClick={() => onShow(first)}>
          {t('planEditor.syncConflicts.strip.show')}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="sync-conflict-mark-all"
        disabled={model.reviewingAll || model.reviewingId !== null}
        onClick={() => void model.onReviewAll()}
      >
        {t('planEditor.syncConflicts.strip.markAll')}
      </Button>
    </div>
  );
}
