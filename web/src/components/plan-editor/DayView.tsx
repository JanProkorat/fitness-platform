import { useTranslation } from 'react-i18next';
import MealBlock from '@/components/plan-editor/MealBlock';
import MealGapDropTarget from '@/components/plan-editor/MealGapDropTarget';
import { dayTotals } from '@/components/plan-editor/plan-editor-nutrition';
import MealRowInsertLine from '@/components/plan-editor/MealRowInsertLine';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { dayRowIndexes, kindRank } from '@/components/plan-editor/plan-editor-ops';
import type { MealKind } from '@/api/generated';
import type { EditorWeek } from '@/components/plan-editor/plan-editor-types';
import type { SelectedCell } from '@/components/plan-editor/WeekGrid';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

interface Props {
  week: EditorWeek;
  weekIndex: number;
  dayOfWeek: number;
  readOnly: boolean;
  selected: SelectedCell | null;
  onSelect: (cell: SelectedCell) => void;
  onEdit: PlanEditorState['edit'];
  /** Asks the host to add a meal between two of the day's meals, given their kinds; without it there are no insert lines. */
  onInsertBetween?: (above: MealKind, below: MealKind) => void;
  /** Alt+Arrow on a focused card: moves that meal's contents one meal up or down the day. */
  onMoveMeal?: (dayOfWeek: number, mealId: string, direction: -1 | 1) => void;
}

/** One weekday of a week: its meals as sortable cards. The day's totals, note and "Add meal" live in the editor's fixed header. */
export default function DayView({ week, weekIndex, dayOfWeek, readOnly, selected, onSelect, onEdit, onInsertBetween, onMoveMeal }: Props) {
  const { t, i18n } = useTranslation();
  const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  // Meals show in the canonical kind order; `rowIndex` is the meal's row in the week grid, so selection and drops address the right meal.
  const rowIndexes = dayRowIndexes(week, day);
  const meals = (day?.meals ?? [])
    .map((meal, position) => ({ meal, position, rowIndex: rowIndexes.get(meal.mealId) ?? -1 }))
    .sort((left, right) => kindRank(left.meal.kind) - kindRank(right.meal.kind) || left.position - right.position);
  const totals = day ? dayTotals(day) : dayTotals({ dayOfWeek, meals: [] });
  const slotMealIds = meals.map(({ meal }) => meal.mealId);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-grid p-3" data-testid="day-view">
      {meals.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label={t('planEditor.day.meals')}>
          {meals.map(({ meal, rowIndex }, position) => (
            <MealBlock
              key={meal.mealId}
              meal={meal}
              rowIndex={rowIndex}
              insertLine={
                position > 0 && !readOnly && onInsertBetween ? (
                  <MealRowInsertLine
                    above={t(`planEditor.rows.${mealKindLabelKey(meals[position - 1].meal.kind)}`)}
                    below={t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`)}
                    onInsert={() => onInsertBetween(meals[position - 1].meal.kind, meal.kind)}
                  />
                ) : null
              }
              gapAbove={
                !readOnly ? (
                  <MealGapDropTarget
                    weekIndex={weekIndex}
                    dayOfWeek={dayOfWeek}
                    gapIndex={position}
                    slotMealIds={slotMealIds}
                  />
                ) : null
              }
              gapBelow={
                !readOnly && position === meals.length - 1 ? (
                  <MealGapDropTarget
                    weekIndex={weekIndex}
                    dayOfWeek={dayOfWeek}
                    gapIndex={meals.length}
                    slotMealIds={slotMealIds}
                    edge="below"
                  />
                ) : null
              }
              onKeyMove={onMoveMeal ? (direction) => onMoveMeal(dayOfWeek, meal.mealId, direction) : undefined}
              weekIndex={weekIndex}
              dayOfWeek={dayOfWeek}
              dayKcal={totals.kcal}
              readOnly={readOnly}
              selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === rowIndex}
              language={i18n.language}
              onSelect={() => onSelect({ dayOfWeek, rowIndex })}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-body text-muted-foreground">
          {t('planEditor.day.noMeals')}
        </p>
      )}
    </div>
  );
}
