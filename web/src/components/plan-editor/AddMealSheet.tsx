import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, Plus } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CHRONOLOGICAL_KINDS } from '@/components/plan-editor/plan-editor-ops';
import { MAX_NOTE_LENGTH } from '@/components/plan-editor/plan-editor-types';

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

interface FormProps {
  dayKinds: readonly MealKind[];
  onSubmit: (kind: MealKind, note: string) => void;
  onCancel: () => void;
}

function AddMealForm({ dayKinds, onSubmit, onCancel }: FormProps) {
  const { t } = useTranslation();
  const available = CHRONOLOGICAL_KINDS.filter((candidate) => !dayKinds.includes(candidate));
  const [kind, setKind] = useState<MealKind | null>(available[0] ?? null);
  const [note, setNote] = useState('');

  return (
    <>
      <form
        id="add-meal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (kind !== null) {
            onSubmit(kind, note);
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
              const present = dayKinds.includes(option);
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
                      {t('planEditor.addMeal.alreadyInDay')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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

        <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-body text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('planEditor.addMeal.emptyHint')}
        </p>
      </form>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="add-meal-form" disabled={kind === null}>
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
  dayLabel: string;
  /** Kinds the day already has; those options are disabled. */
  dayKinds: readonly MealKind[];
  onSubmit: (kind: MealKind, note: string) => void;
}

/** Right-hand drawer that adds an empty meal to one day; it lands at its kind's place in the day. */
export default function AddMealSheet({ open, onOpenChange, dayLabel, dayKinds, onSubmit }: Props) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:w-drawer sm:max-w-none">
        <SheetHeader className="gap-1 border-b border-border p-6">
          <SheetTitle className="text-panel-title font-bold">{t('planEditor.addMeal.title')}</SheetTitle>
          <SheetDescription className="text-body">{t('planEditor.addMeal.forDay', { day: dayLabel })}</SheetDescription>
        </SheetHeader>
        <AddMealForm dayKinds={dayKinds} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
