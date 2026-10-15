import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, Info, Plus } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CHRONOLOGICAL_KINDS, everyDayHasKind, weekKindPresence } from '@/components/plan-editor/plan-editor-ops';
import { MAX_MEALS_PER_DAY, MAX_NOTE_LENGTH, type EditorWeek } from '@/components/plan-editor/plan-editor-types';

/** Label key under `planTemplates.slots` for each kind; the two snacks read "Snack" and "Snack 2". */
const SLOT_LABEL: Record<MealKind, string> = {
  [MealKind.Breakfast]: 'breakfast',
  [MealKind.MorningSnack]: 'snack',
  [MealKind.Lunch]: 'lunch',
  [MealKind.AfternoonSnack]: 'snack2',
  [MealKind.Dinner]: 'dinner',
  [MealKind.PreWorkout]: 'preWorkout',
  [MealKind.PostWorkout]: 'postWorkout',
};

export type AddMealMode = 'day' | 'week';

interface FormProps {
  mode: AddMealMode;
  /** Kinds the active day already has (day mode). */
  dayKinds: readonly MealKind[];
  /** The week the meal goes into (week mode). */
  week: EditorWeek;
  /** The kind that starts selected; null starts with nothing selected. */
  preselect: MealKind | null;
  onSubmitDay: (kind: MealKind, note: string) => void;
  onSubmitWeek: (kind: MealKind) => void;
  onCancel: () => void;
}

function dayList(days: readonly number[], t: TFunction): string {
  return days.map((day) => t(`planEditor.daysLong.${day}`)).join(', ');
}

function AddMealForm({ mode, dayKinds, week, preselect, onSubmitDay, onSubmitWeek, onCancel }: FormProps) {
  const { t } = useTranslation();
  const weekMode = mode === 'week';
  const [kind, setKind] = useState<MealKind | null>(preselect);
  const [note, setNote] = useState('');
  const presence = kind !== null && weekMode ? weekKindPresence(week, kind) : null;
  const canSubmit = kind !== null && (!presence || presence.addable.length > 0);

  return (
    <>
      <form
        id="add-meal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (kind === null || !canSubmit) {
            return;
          }
          if (weekMode) {
            onSubmitWeek(kind);
          } else {
            onSubmitDay(kind, note);
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
      >
        <div className="flex flex-col gap-2">
          <span id="add-meal-type-label" className="text-body font-medium text-foreground">
            {t('planEditor.addMeal.type')} <span className="text-destructive">*</span>
          </span>
          <div role="radiogroup" aria-labelledby="add-meal-type-label" className="grid grid-cols-2 gap-3">
            {CHRONOLOGICAL_KINDS.map((option) => {
              const present = weekMode ? everyDayHasKind(week, option) : dayKinds.includes(option);
              const active = option === kind;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={present}
                  onClick={() => setKind(option)}
                  className={cn(
                    'flex h-15 flex-col items-center justify-center gap-0.5 rounded-xl border text-copy font-semibold text-ink outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    present ? 'cursor-not-allowed border-line bg-muted opacity-60' : 'cursor-pointer',
                    !present && (active ? 'border-2 border-ink bg-card' : 'border-line bg-card hover:bg-muted'),
                  )}
                >
                  <span className="flex items-center gap-2">
                    {active && <Check className="size-4" aria-hidden="true" />}
                    {t(`planTemplates.slots.${SLOT_LABEL[option]}`)}
                  </span>
                  {present && (
                    <span className="text-meta font-normal text-muted-foreground">
                      {t(weekMode ? 'planEditor.addMeal.alreadyInWeek' : 'planEditor.addMeal.alreadyInDay')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {presence && (
          <div data-testid="add-meal-week-summary" className="flex flex-col gap-1 text-body text-muted-foreground">
            <p>
              {presence.addable.length > 0
                ? t('planEditor.addMeal.weekWillAdd', { count: presence.addable.length })
                : t('planEditor.addMeal.weekNothingToAdd')}
              {presence.present.length > 0 &&
                `; ${t('planEditor.addMeal.weekAlreadyHave', {
                  count: presence.present.length,
                  days: dayList(presence.present, t),
                })}`}
            </p>
            {presence.capped.length > 0 && (
              <p>
                {t('planEditor.addMeal.weekCapped', {
                  max: MAX_MEALS_PER_DAY,
                  days: dayList(presence.capped, t),
                })}
              </p>
            )}
          </div>
        )}

        {!weekMode && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-meal-note" className="text-body font-medium text-foreground">
              {t('planEditor.noteForClient')}{' '}
              <span className="font-normal text-muted-foreground">{t('planEditor.addMeal.optional')}</span>
            </label>
            <Textarea
              id="add-meal-note"
              rows={4}
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        )}

        <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-body text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('planEditor.addMeal.emptyHint')}
        </p>
      </form>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="add-meal-form" disabled={!canSubmit}>
          <Plus aria-hidden="true" />
          {t('planEditor.addMeal.submit')}
        </Button>
      </SheetFooter>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AddMealMode;
  /** Changes on every open, so the form starts over with that open's preselection. */
  requestKey: number;
  /** The kind that starts selected; null starts with nothing selected. */
  preselect: MealKind | null;
  dayLabel: string;
  weekNumber: number;
  /** Kinds the active day already has; in day mode those options are disabled. */
  dayKinds: readonly MealKind[];
  week: EditorWeek;
  onSubmitDay: (kind: MealKind, note: string) => void;
  onSubmitWeek: (kind: MealKind) => void;
}

/** Right-hand drawer that adds an empty meal to one day, or to every day of the week that lacks one. */
export default function AddMealSheet({
  open,
  onOpenChange,
  mode,
  requestKey,
  preselect,
  dayLabel,
  weekNumber,
  dayKinds,
  week,
  onSubmitDay,
  onSubmitWeek,
}: Props) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:w-drawer sm:max-w-none">
        <SheetHeader className="gap-1 border-b border-border p-6">
          <SheetTitle className="text-panel-title font-bold">{t('planEditor.addMeal.title')}</SheetTitle>
          <SheetDescription className="text-body">
            {mode === 'week'
              ? t('planEditor.addMeal.forWeek', { week: weekNumber })
              : t('planEditor.addMeal.forDay', { day: dayLabel })}
          </SheetDescription>
        </SheetHeader>
        <AddMealForm
          key={requestKey}
          mode={mode}
          dayKinds={dayKinds}
          week={week}
          preselect={preselect}
          onSubmitDay={onSubmitDay}
          onSubmitWeek={onSubmitWeek}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
