import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, StickyNote, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import KcalReadout from '@/components/plan-editor/KcalReadout';
import MacroDots from '@/components/plan-editor/MacroDots';
import type { Totals } from '@/components/plan-editor/plan-editor-nutrition';
import { MAX_NOTE_LENGTH } from '@/components/plan-editor/plan-editor-types';

const ACTION_CLASS =
  'inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-body font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40';

interface Props {
  totals: Totals;
  /** Daily kcal target; the dot colour follows how close the day is to it. */
  kcalTarget: number | undefined;
  note: string | undefined;
  readOnly: boolean;
  addMealDisabled: boolean;
  addMealTitle: string | undefined;
  onAddMeal: () => void;
  onNoteChange: (note: string) => void;
}

/** One lean card for the day: total against target, "Add meal" and "Add day note", and the note line. */
export default function DaySummaryCard({
  totals,
  kcalTarget,
  note,
  readOnly,
  addMealDisabled,
  addMealTitle,
  onAddMeal,
  onNoteChange,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const hasNote = Boolean(note);
  // A day with a note keeps its line open; an empty line goes away once it loses focus.
  const showNote = readOnly ? hasNote : hasNote || editing;

  return (
    <div data-testid="day-summary" className="flex flex-col rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-body text-ink">
        <span className="font-semibold">{t('planEditor.dayTotal')}</span>
        <KcalReadout kcal={totals.kcal} target={kcalTarget} />
        <MacroDots
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          fiber={totals.fiber}
          fiberUnit
          className="gap-x-4"
        />
        {!readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="day-add-meal"
              disabled={addMealDisabled}
              title={addMealTitle}
              onClick={onAddMeal}
              className={cn(ACTION_CLASS, 'cursor-pointer border-line bg-card text-ink hover:bg-muted')}
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              {t('planEditor.addMeal.open')}
            </button>
            <button
              type="button"
              data-testid="day-note-toggle"
              disabled={hasNote}
              title={hasNote ? t('planEditor.day.noteShownBelow') : undefined}
              onClick={() => setEditing(true)}
              className={cn(
                ACTION_CLASS,
                'border-line text-muted-foreground',
                !hasNote && 'cursor-pointer hover:bg-muted hover:text-ink',
              )}
            >
              <StickyNote className="size-4 shrink-0" aria-hidden="true" />
              {t('planEditor.day.addNote')}
            </button>
          </div>
        )}
      </div>
      {showNote && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-1">
          <StickyNote className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {readOnly ? (
            <p className="min-w-0 flex-1 py-1.5 text-body text-ink [overflow-wrap:anywhere]">{note}</p>
          ) : (
            <>
              <Input
                value={note ?? ''}
                maxLength={MAX_NOTE_LENGTH}
                autoFocus={editing}
                aria-label={t('planEditor.day.noteLabel')}
                placeholder={t('planEditor.day.notePlaceholder')}
                onChange={(event) => onNoteChange(event.target.value)}
                onFocus={() => setEditing(true)}
                onBlur={() => setEditing(false)}
                className="h-8 flex-1 border-transparent bg-transparent px-1 shadow-none"
              />
              <button
                type="button"
                data-testid="day-note-remove"
                aria-label={t('planEditor.day.removeNote')}
                title={t('planEditor.day.removeNote')}
                onClick={() => {
                  setEditing(false);
                  onNoteChange('');
                }}
                className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
