import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, Plus } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { MAX_NOTE_LENGTH } from '@/components/plan-editor/plan-editor-types';

/** The types offered; "snack" becomes the morning or afternoon snack per day. */
const KIND_OPTIONS: readonly MealKind[] = [
  MealKind.Breakfast,
  MealKind.MorningSnack,
  MealKind.Lunch,
  MealKind.Dinner,
  MealKind.PreWorkout,
  MealKind.PostWorkout,
];

function optionKind(kind: MealKind): MealKind {
  return kind === MealKind.AfternoonSnack ? MealKind.MorningSnack : kind;
}

interface FormProps {
  dayKinds: readonly MealKind[];
  afterKind: MealKind | null;
  onSubmit: (kind: MealKind, note: string) => void;
  onCancel: () => void;
}

function AddMealForm({ dayKinds, afterKind, onSubmit, onCancel }: FormProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MealKind>(afterKind ? optionKind(afterKind) : MealKind.Breakfast);
  const [note, setNote] = useState('');
  const hasKind = dayKinds.some((existing) => optionKind(existing) === kind);

  return (
    <>
      <form
        id="add-meal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(kind, note);
        }}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
      >
        <div className="flex flex-col gap-2">
          <span id="add-meal-type-label" className="text-body font-medium text-foreground">
            {t('planEditor.addMeal.type')} <span className="text-destructive">*</span>
          </span>
          <div role="radiogroup" aria-labelledby="add-meal-type-label" className="grid grid-cols-2 gap-3">
            {KIND_OPTIONS.map((option) => {
              const active = option === kind;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(option)}
                  className={cn(
                    'flex h-15 cursor-pointer items-center justify-center gap-2 rounded-xl border text-copy font-semibold text-ink outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    active ? 'border-2 border-ink bg-card' : 'border-line bg-card hover:bg-muted',
                  )}
                >
                  {active && <Check className="size-4" aria-hidden="true" />}
                  {t(`planEditor.rows.${mealKindLabelKey(option)}`)}
                </button>
              );
            })}
          </div>
          {hasKind && (
            <p className="text-meta text-muted-foreground">
              {t('planEditor.addMeal.alreadyHas', { meal: t(`planEditor.rows.${mealKindLabelKey(kind)}`) })}
            </p>
          )}
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
        <Button type="submit" form="add-meal-form">
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
  /** Kind of the meal the new one goes after, or null when it goes first. */
  afterKind: MealKind | null;
  dayKinds: readonly MealKind[];
  onSubmit: (kind: MealKind, note: string) => void;
}

/** Right-hand drawer that adds an empty meal to one day. */
export default function AddMealSheet({ open, onOpenChange, dayLabel, afterKind, dayKinds, onSubmit }: Props) {
  const { t } = useTranslation();
  const subtitle = afterKind
    ? t('planEditor.addMeal.after', { day: dayLabel, meal: t(`planEditor.rows.${mealKindLabelKey(afterKind)}`) })
    : t('planEditor.addMeal.first', { day: dayLabel });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:w-drawer sm:max-w-none">
        <SheetHeader className="gap-1 border-b border-border p-6">
          <SheetTitle className="text-panel-title font-bold">{t('planEditor.addMeal.title')}</SheetTitle>
          <SheetDescription className="text-body">{subtitle}</SheetDescription>
        </SheetHeader>
        <AddMealForm
          dayKinds={dayKinds}
          afterKind={afterKind}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
