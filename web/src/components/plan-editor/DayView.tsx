import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { formatCalendarDate } from '@/components/client-plan-editor/clientPlanDates';
import MealBlock from '@/components/plan-editor/MealBlock';
import SyncConflictGhostCard from '@/components/plan-editor/sync-conflicts/SyncConflictGhostCard';
import { useSyncConflicts } from '@/components/plan-editor/sync-conflicts/SyncConflictsContext';
import { placeGhosts } from '@/components/plan-editor/sync-conflicts/syncConflictModel';
import { isPastDay, removedGhosts, slotDate, useMealLocks } from '@/components/plan-editor/meal-locks';
import { dayTotals } from '@/components/plan-editor/plan-editor-nutrition';
import MealRowInsertLine from '@/components/plan-editor/MealRowInsertLine';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { dayRowIndexes, kindRank, rowMeal, weekRows } from '@/components/plan-editor/plan-editor-ops';
import type { MealKind } from '@/api/generated';
import type { GridDragView } from '@/components/plan-editor/plan-editor-library';
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
  /** What is being dragged over the day: a meal card, with the contents already slid into place. */
  drag?: GridDragView | null;
}

/** One weekday of a week: its meals as sortable cards. The day's totals, note and "Add meal" live in the editor's fixed header. */
export default function DayView({
  week,
  weekIndex,
  dayOfWeek,
  readOnly,
  selected,
  onSelect,
  onEdit,
  onInsertBetween,
  onMoveMeal,
  drag = null,
}: Props) {
  const { t, i18n } = useTranslation();
  const conflicts = useSyncConflicts();
  const locks = useMealLocks();
  const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  // Meals the client ate that the coach removed show read-only after the day's own meals; they are never saved.
  const ghosts = locks ? removedGhosts(locks, weekIndex, dayOfWeek) : [];
  const pastDay = locks ? isPastDay(locks, week.weekNumber, dayOfWeek) : false;
  const pastDate = locks ? slotDate(locks.startDate, week.weekNumber, dayOfWeek) : null;
  // On a past day a row with no meal reads "Nothing planned", unless a removed-but-eaten meal sits in it.
  const takenByGhost = new Set([...placeGhosts(week, ghosts).inRow.keys()]);
  const emptyRows = pastDay
    ? weekRows(week).filter((row) => !rowMeal(day, row) && !takenByGhost.has(`${dayOfWeek}:${row.index}`))
    : [];
  // Meals show in the canonical kind order; `rowIndex` is the meal's row in the week grid, so selection and drops address the right meal.
  const rowIndexes = dayRowIndexes(week, day);
  const meals = (day?.meals ?? [])
    .map((meal, position) => ({ meal, position, rowIndex: rowIndexes.get(meal.mealId) ?? -1 }))
    .sort((left, right) => kindRank(left.meal.kind) - kindRank(right.meal.kind) || left.position - right.position);
  const totals = day ? dayTotals(day) : dayTotals({ dayOfWeek, meals: [] });
  // The slots stay the real day's; only what they show comes from the preview while a move is hovered.
  const shownDay = (drag?.kind === 'cell' ? drag.week : week).days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const shownMeals = new Map((shownDay?.meals ?? []).map((meal) => [meal.mealId, meal] as const));

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-grid p-3" data-testid="day-view">
      {pastDay && locks && (
        <p
          role="note"
          data-testid="day-past-banner"
          className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-body text-muted-foreground"
        >
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <b className="font-semibold text-ink">
              {/* The formatted date already carries the weekday, so the day name is not passed separately. */}
              {t('planEditor.locks.pastBanner.lead', {
                date: pastDate ? formatCalendarDate(pastDate, i18n.language) : '',
              })}
            </b>{' '}
            {t('planEditor.locks.pastBanner.body', { client: locks.clientName })}
          </span>
        </p>
      )}
      {meals.length > 0 || ghosts.length > 0 || emptyRows.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label={t('planEditor.day.meals')}>
          {meals.map(({ meal, rowIndex }, position) => (
            <MealBlock
              key={meal.mealId}
              meal={meal}
              display={shownMeals.get(meal.mealId)}
              drag={drag}
              rowIndex={rowIndex}
              insertLine={
                position > 0 && !readOnly && !pastDay && onInsertBetween ? (
                  <MealRowInsertLine
                    above={t(`planEditor.rows.${mealKindLabelKey(meals[position - 1].meal.kind)}`)}
                    below={t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`)}
                    onInsert={() => onInsertBetween(meals[position - 1].meal.kind, meal.kind)}
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
          {ghosts.map((ghost) => (
            <SyncConflictGhostCard
              key={ghost.id}
              ghost={ghost}
              placed={conflicts?.byConflictId(ghost.id)}
              model={conflicts}
            />
          ))}
          {emptyRows.map((row) => (
            <li
              key={`empty-${row.index}`}
              data-testid="day-nothing-planned"
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4"
            >
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-display text-card-title font-semibold text-ink">
                {t(`planEditor.rows.${mealKindLabelKey(row.kind)}`)}
              </span>
              <span className="text-body text-muted-foreground">{t('planEditor.locks.nothingPlanned')}</span>
            </li>
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
