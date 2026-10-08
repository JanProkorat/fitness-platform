import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MacroDots from '@/components/plan-editor/MacroDots';
import MealItemRow from '@/components/plan-editor/MealItemRow';
import { MacroBar } from '@/components/plan-editor/WeekGrid';
import { DAY_ORDER, mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { mealItemEntries, mealTotals } from '@/components/plan-editor/plan-editor-nutrition';
import {
  copyMealToDays,
  removeFoodAt,
  removeRecipeAt,
  setFoodAmount,
  setMealNote,
  setRecipeServings,
} from '@/components/plan-editor/plan-editor-ops';
import { MAX_NOTE_LENGTH, type EditorMeal } from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

interface Props {
  meal: EditorMeal;
  weekIndex: number;
  weekNumber: number;
  dayOfWeek: number;
  readOnly: boolean;
  language: string;
  onEdit: PlanEditorState['edit'];
  onClose: () => void;
}

/** The popover over a week-grid cell: edit a meal's items and note, or copy it to other weekdays. */
export default function MealDetail({ meal, weekIndex, weekNumber, dayOfWeek, readOnly, language, onEdit, onClose }: Props) {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<number[]>([]);
  const [copiedTo, setCopiedTo] = useState<number[] | null>(null);
  const totals = mealTotals(meal);
  const entries = mealItemEntries(meal, language);

  function toggleTarget(day: number) {
    setCopiedTo(null);
    setTargets((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  function copy() {
    const days = targets;
    onEdit((doc) => copyMealToDays(doc, weekIndex, dayOfWeek, meal.mealId, days));
    setCopiedTo(days);
    setTargets([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body text-muted-foreground">
            {t('planEditor.detail.where', { day: t(`planEditor.days.${dayOfWeek}`), week: weekNumber })}
          </span>
          <h2 className="font-display text-panel-title font-semibold text-ink">
            {t('planEditor.detail.title', {
              meal: t(`planEditor.rows.${mealKindLabelKey(meal.kind)}`),
              kcal: Math.round(totals.kcal),
            })}
          </h2>
        </div>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <ul className="flex flex-col gap-3 border-y border-line py-3">
        {entries.map((entry) => (
          <MealItemRow
            key={`${entry.type}:${entry.index}`}
            entry={entry}
            readOnly={readOnly}
            variant="popover"
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

      {!readOnly && (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-body text-muted-foreground">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {t('planEditor.detail.dropHint')}
        </p>
      )}

      <div className="flex items-center gap-4 text-body text-ink">
        <span className="font-semibold">{t('planEditor.cell.kcal', { kcal: Math.round(totals.kcal) })}</span>
        <MacroDots
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          fiber={totals.fiber}
          fiberUnit
          className="text-muted-foreground"
        />
        <span className="ml-auto w-30 shrink-0">
          <MacroBar totals={totals} />
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`meal-note-${meal.mealId}`} className="text-body font-semibold text-muted-foreground">
          {t('planEditor.noteForClient')}
        </label>
        {readOnly ? (
          <p className="text-copy text-ink">{meal.note || t('planEditor.detail.noNote')}</p>
        ) : (
          <Input
            id={`meal-note-${meal.mealId}`}
            value={meal.note ?? ''}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) =>
              onEdit((doc) => setMealNote(doc, weekIndex, dayOfWeek, meal.mealId, event.target.value), `note:${meal.mealId}`)
            }
            className="h-10"
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <span id={`copy-to-${meal.mealId}`} className="text-body font-semibold text-muted-foreground">
            {t('planEditor.detail.copyTo')}
          </span>
          <div className="flex items-center gap-2">
            <div role="group" aria-labelledby={`copy-to-${meal.mealId}`} className="flex flex-1 gap-2">
              {DAY_ORDER.map((day) => {
                const own = day === dayOfWeek;
                const active = targets.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={own}
                    aria-pressed={active}
                    aria-label={t(`planEditor.days.${day}`)}
                    onClick={() => toggleTarget(day)}
                    className={cn(
                      'flex size-10 cursor-pointer items-center justify-center rounded-lg border text-body font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
                      active ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
                    )}
                  >
                    {t(`planEditor.dayInitials.${day}`)}
                  </button>
                );
              })}
            </div>
            <Button type="button" variant="outline" disabled={targets.length === 0} onClick={copy}>
              <Copy aria-hidden="true" />
              {t('planEditor.detail.copy')}
            </Button>
          </div>
          <p role="status" className="min-h-4 text-meta text-muted-foreground">
            {copiedTo ? t('planEditor.detail.copied', { days: copiedTo.map((day) => t(`planEditor.days.${day}`)).join(', ') }) : ''}
          </p>
        </div>
      )}
    </div>
  );
}
