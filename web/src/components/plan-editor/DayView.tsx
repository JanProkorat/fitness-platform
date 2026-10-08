import { useTranslation } from 'react-i18next';
import MealBlock from '@/components/plan-editor/MealBlock';
import { dayTotals } from '@/components/plan-editor/plan-editor-nutrition';
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
}

/** One weekday of a week: its meals as sortable cards. The day's totals, note and "Add meal" live in the editor's fixed header. */
export default function DayView({ week, weekIndex, dayOfWeek, readOnly, selected, onSelect, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const meals = day?.meals ?? [];
  const totals = day ? dayTotals(day) : dayTotals({ dayOfWeek, meals: [] });

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-grid p-3" data-testid="day-view">
      {meals.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label={t('planEditor.day.meals')}>
          {meals.map((meal, index) => (
            <MealBlock
              key={meal.mealId}
              meal={meal}
              index={index}
              weekIndex={weekIndex}
              dayOfWeek={dayOfWeek}
              dayKcal={totals.kcal}
              readOnly={readOnly}
              selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === index}
              language={i18n.language}
              onSelect={() => onSelect({ dayOfWeek, rowIndex: index })}
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
