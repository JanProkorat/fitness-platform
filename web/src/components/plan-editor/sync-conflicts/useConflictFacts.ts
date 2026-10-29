import { useTranslation } from 'react-i18next';
import { formatCalendarDate } from '@/components/client-plan-editor/clientPlanDates';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import type { SyncConflictsModel } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import {
  compareConflict,
  formatConflictTime,
  type PlacedConflict,
} from '@/components/plan-editor/sync-conflicts/syncConflictModel';

/** What the panels say about one conflict: when, which meal, the two plan versions and the item comparison. */
export function useConflictFacts(placed: PlacedConflict, model: SyncConflictsModel) {
  const { t, i18n } = useTranslation();
  const { conflict } = placed;
  const logDate = conflict.logDate?.slice(0, 10);
  return {
    removed: placed.ghost || conflict.kind === 'MealRemoved',
    meal: conflict.mealKind ? t(`planEditor.rows.${mealKindLabelKey(conflict.mealKind)}`) : '',
    date: logDate ? formatCalendarDate(logDate, i18n.language) : '',
    time: formatConflictTime(conflict.occurredAt, i18n.language),
    sawVersion: conflict.basedOnPlanVersion,
    nowVersion: model.planVersion ?? conflict.currentPlanVersion,
    comparison: compareConflict(conflict, placed.meal, i18n.language),
  };
}
