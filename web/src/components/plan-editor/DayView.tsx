import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { Button } from '@/components/ui/button';
import AddMealSheet from '@/components/plan-editor/AddMealSheet';
import DayMacroBar from '@/components/plan-editor/DayMacroBar';
import DayNavigator from '@/components/plan-editor/DayNavigator';
import MealBlock from '@/components/plan-editor/MealBlock';
import WeekdayPills from '@/components/plan-editor/WeekdayPills';
import { dayTotals } from '@/components/plan-editor/plan-editor-nutrition';
import { addMealToDay, nextSnackKindForDay, setDayNote } from '@/components/plan-editor/plan-editor-ops';
import {
  MAX_MEALS_PER_DAY,
  type EditorWeek,
  type PlanTargets,
} from '@/components/plan-editor/plan-editor-types';
import type { SelectedCell } from '@/components/plan-editor/WeekGrid';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

interface Props {
  week: EditorWeek;
  weekIndex: number;
  weekCount: number;
  dayOfWeek: number;
  targets: PlanTargets | undefined;
  readOnly: boolean;
  selected: SelectedCell | null;
  onSelect: (cell: SelectedCell) => void;
  onDayChange: (dayOfWeek: number) => void;
  onWeekChange: (delta: -1 | 1) => void;
  onEdit: PlanEditorState['edit'];
}

/** One weekday of a week: its meals as sortable cards, with the day's kcal and macros on top. */
export default function DayView({
  week,
  weekIndex,
  weekCount,
  dayOfWeek,
  targets,
  readOnly,
  selected,
  onSelect,
  onDayChange,
  onWeekChange,
  onEdit,
}: Props) {
  const { t, i18n } = useTranslation();
  const [addAfter, setAddAfter] = useState<number | null>(null);
  const day = week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const meals = day?.meals ?? [];
  const totals = day ? dayTotals(day) : dayTotals({ dayOfWeek, meals: [] });
  const atLimit = meals.length >= MAX_MEALS_PER_DAY;
  const afterMeal = addAfter !== null ? meals[addAfter] : undefined;

  function addMeal(kind: MealKind, note: string) {
    const resolved = kind === MealKind.MorningSnack ? nextSnackKindForDay(day) : kind;
    const afterIndex = addAfter ?? meals.length - 1;
    onEdit((doc) => addMealToDay(doc, weekIndex, dayOfWeek, resolved, afterIndex, note));
    setAddAfter(null);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="day-view">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <DayNavigator weekIndex={weekIndex} weekCount={weekCount} onWeekChange={onWeekChange} />
        <WeekdayPills week={week} current={dayOfWeek} dailyKcalTarget={targets?.kcal} onSelect={onDayChange} />
      </div>

      <DayMacroBar
        totals={totals}
        targets={targets}
        note={day?.note}
        readOnly={readOnly}
        onNoteChange={(note) => onEdit((doc) => setDayNote(doc, weekIndex, dayOfWeek, note), `daynote:${weekIndex}:${dayOfWeek}`)}
      />

      {meals.length > 0 ? (
        <ul className="flex flex-col rounded-xl border border-line bg-card" aria-label={t('planEditor.day.meals')}>
          {meals.map((meal, index) => (
            <MealBlock
              key={meal.mealId}
              meal={meal}
              index={index}
              mealCount={meals.length}
              weekIndex={weekIndex}
              dayOfWeek={dayOfWeek}
              dayKcal={totals.kcal}
              readOnly={readOnly}
              selected={selected?.dayOfWeek === dayOfWeek && selected.rowIndex === index}
              language={i18n.language}
              onSelect={() => onSelect({ dayOfWeek, rowIndex: index })}
              onAddAfter={() => setAddAfter(index)}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-body text-muted-foreground">
          {t('planEditor.day.noMeals')}
        </p>
      )}

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={atLimit}
          title={atLimit ? t('planEditor.day.limitReached', { max: MAX_MEALS_PER_DAY }) : undefined}
          onClick={() => setAddAfter(meals.length - 1)}
        >
          <Plus aria-hidden="true" />
          {t('planEditor.addMeal.open')}
        </Button>
      )}

      <AddMealSheet
        open={addAfter !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddAfter(null);
          }
        }}
        dayLabel={t(`planEditor.daysLong.${dayOfWeek}`)}
        afterKind={afterMeal?.kind ?? null}
        dayKinds={meals.map((meal) => meal.kind)}
        onSubmit={addMeal}
      />
    </div>
  );
}
