import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MealItemRow from '@/components/plan-editor/MealItemRow';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import {
  mealDayShareStatus,
  mealItemEntries,
  mealTotals,
  type ShareStatus,
} from '@/components/plan-editor/plan-editor-nutrition';
import {
  removeFoodAt,
  removeMeal,
  removeRecipeAt,
  setFoodAmount,
  setMealNote,
  setRecipeServings,
} from '@/components/plan-editor/plan-editor-ops';
import { MAX_MEALS_PER_DAY, MAX_NOTE_LENGTH, type EditorMeal } from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

const SHARE_CHIP_CLASS: Record<ShareStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  on: 'bg-success-soft text-success-ink',
  over: 'bg-training-soft text-training-ink',
  under: 'bg-muted text-muted-foreground',
};

interface Props {
  meal: EditorMeal;
  index: number;
  mealCount: number;
  weekIndex: number;
  dayOfWeek: number;
  dayKcal: number;
  readOnly: boolean;
  selected: boolean;
  language: string;
  onSelect: () => void;
  onAddAfter: () => void;
  onEdit: PlanEditorState['edit'];
}

/** One meal of the day: sortable by its whole card, with its items, note and delete. */
export default function MealBlock({
  meal,
  index,
  mealCount,
  weekIndex,
  dayOfWeek,
  dayKcal,
  readOnly,
  selected,
  language,
  onSelect,
  onAddAfter,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const { ref, isDragging, isDropTarget } = useSortable({
    id: meal.mealId,
    index,
    disabled: readOnly,
    data: { type: 'meal', dayOfWeek, rowIndex: index },
  });
  const totals = mealTotals(meal);
  const entries = mealItemEntries(meal, language);
  const share = mealDayShareStatus(totals.kcal, dayKcal, meal.kind);
  const kindLabel = t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`);

  return (
    <li
      ref={ref}
      data-testid="meal-block"
      data-meal-id={meal.mealId}
      tabIndex={readOnly ? undefined : 0}
      aria-label={kindLabel}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-raised-line bg-raised p-5 shadow-raised outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50',
        !readOnly && !isDragging && 'hover:-translate-y-px hover:shadow-raised-hover motion-reduce:hover:translate-y-0',
        selected && 'ring-2 ring-ink ring-inset',
        isDropTarget && !isDragging && 'border-nutrition bg-nutrition-soft',
        isDragging && 'opacity-60 shadow-selection-bar',
      )}
    >
      <div className={cn('flex items-center gap-3', !readOnly && 'cursor-grab active:cursor-grabbing')}>
        {!readOnly && <GripVertical className="size-4 shrink-0 text-faint" aria-hidden="true" />}
        <h3 className="font-display text-card-title font-semibold text-ink">{kindLabel}</h3>
        <span className="text-copy font-semibold text-ink">
          {t('planEditor.cell.kcal', { kcal: Math.round(totals.kcal) })}
        </span>
        {dayKcal > 0 && (
          <span
            data-testid="meal-share"
            data-status={share.status}
            className={cn('rounded-full px-2.5 py-1 text-meta font-semibold', SHARE_CHIP_CLASS[share.status])}
          >
            {t('planEditor.day.percentOfDay', { percent: Math.round((totals.kcal / dayKcal) * 100) })}
          </span>
        )}
        {!readOnly && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label={t('planEditor.day.addAfter', { meal: kindLabel })}
              title={t('planEditor.day.addAfter', { meal: kindLabel })}
              disabled={mealCount >= MAX_MEALS_PER_DAY}
              onClick={(event) => {
                event.stopPropagation();
                onAddAfter();
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t('planEditor.day.removeMeal', { meal: kindLabel })}
              title={t('planEditor.day.removeMeal', { meal: kindLabel })}
              onClick={(event) => {
                event.stopPropagation();
                onEdit((doc) => removeMeal(doc, weekIndex, dayOfWeek, meal.mealId));
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-error focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <MealItemRow
              key={`${entry.type}:${entry.index}`}
              entry={entry}
              readOnly={readOnly}
              variant="day"
              position={{ weekIndex, dayOfWeek, mealId: meal.mealId }}
              onAmount={(value) =>
                onEdit(
                  (doc) =>
                    entry.type === 'recipe'
                      ? setRecipeServings(doc, weekIndex, dayOfWeek, meal.mealId, entry.index, value)
                      : setFoodAmount(doc, weekIndex, dayOfWeek, meal.mealId, entry.index, value),
                  `amount:${meal.mealId}:${entry.type}:${entry.index}`,
                )
              }
              onRemove={() =>
                onEdit((doc) =>
                  entry.type === 'recipe'
                    ? removeRecipeAt(doc, weekIndex, dayOfWeek, meal.mealId, entry.index)
                    : removeFoodAt(doc, weekIndex, dayOfWeek, meal.mealId, entry.index),
                )
              }
            />
          ))}
        </ul>
      ) : (
        !readOnly && (
          <p className="rounded-xl border border-dashed border-line px-4 py-3 text-body text-muted-foreground">
            {t('planEditor.day.emptyMeal')}
          </p>
        )
      )}

      {readOnly ? (
        meal.note && (
          <p className="flex items-center gap-2 text-body text-ink">
            <StickyNote className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {meal.note}
          </p>
        )
      ) : (
        <div className="relative">
          <StickyNote
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={meal.note ?? ''}
            maxLength={MAX_NOTE_LENGTH}
            aria-label={t('planEditor.day.mealNoteLabel', { meal: kindLabel })}
            placeholder={t('planEditor.day.notePlaceholder')}
            onChange={(event) =>
              onEdit((doc) => setMealNote(doc, weekIndex, dayOfWeek, meal.mealId, event.target.value), `note:${meal.mealId}`)
            }
            className="h-10 pl-10"
          />
        </div>
      )}
    </li>
  );
}
