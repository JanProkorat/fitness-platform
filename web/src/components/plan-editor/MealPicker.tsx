import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Plus, Utensils } from 'lucide-react';
import { MealKind } from '@/api/generated';
import { mealKindLabelKey } from '@/components/plan-editor/plan-editor-format';
import { COMMON_MEAL_KINDS } from '@/components/plan-editor/plan-editor-ops';
import { cn } from '@/lib/utils';

const ADD_CHIPS: readonly { kind: MealKind; labelKey: string }[] = [
  { kind: MealKind.Breakfast, labelKey: 'breakfast' },
  { kind: MealKind.MorningSnack, labelKey: 'snack' },
  { kind: MealKind.Lunch, labelKey: 'lunch' },
  { kind: MealKind.Dinner, labelKey: 'dinner' },
  { kind: MealKind.PreWorkout, labelKey: 'preWorkout' },
  { kind: MealKind.PostWorkout, labelKey: 'postWorkout' },
];

type Staged = Partial<Record<MealKind, 1 | 2>>;

interface Props {
  onApplyCommon: () => void;
  /** Receives every staged meal kind in chip order, a kind chosen twice appearing twice. */
  onDone: (kinds: MealKind[]) => void;
  /** Shown as a link when the host can offer another template's meals. */
  onCopyMeals?: () => void;
}

/** Empty-week card that stages a choice of meals and turns it into the week's rows on Done. */
export default function MealPicker({ onApplyCommon, onDone, onCopyMeals }: Props) {
  const { t } = useTranslation();
  const [staged, setStaged] = useState<Staged>({});
  const kinds = ADD_CHIPS.flatMap((chip) => Array.from({ length: staged[chip.kind] ?? 0 }, () => chip.kind));

  /** First click selects, the second makes it x2, the third clears it. */
  function cycle(kind: MealKind) {
    setStaged((current) => {
      const next = { ...current };
      const count = current[kind] ?? 0;
      if (count === 0) {
        next[kind] = 1;
      } else if (count === 1) {
        next[kind] = 2;
      } else {
        delete next[kind];
      }
      return next;
    });
  }

  return (
    <section
      aria-labelledby="plan-editor-picker-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-card"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-nutrition-soft text-nutrition-ink">
          <Utensils className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="plan-editor-picker-title" className="font-display text-panel-title font-semibold text-ink">
            {t('planEditor.picker.title')}
          </h2>
          <p className="text-body text-muted-foreground">{t('planEditor.picker.body')}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onApplyCommon}
        className="flex items-center gap-3 rounded-xl border-2 border-ink bg-card px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Check className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-copy font-semibold text-ink">
          {COMMON_MEAL_KINDS.map((kind) => t(`planEditor.rows.${mealKindLabelKey(kind)}`)).join(' · ')}
        </span>
        <span className="text-body text-muted-foreground">{t('planEditor.picker.mostCommon')}</span>
      </button>

      <div className="flex flex-col gap-2.5">
        <span className="text-label font-semibold tracking-label text-muted-foreground uppercase">
          {t('planEditor.picker.addOneByOne')}
        </span>
        <div className="flex flex-wrap gap-2">
          {ADD_CHIPS.map((chip) => {
            const count = staged[chip.kind] ?? 0;
            return (
              <button
                key={chip.kind}
                type="button"
                aria-pressed={count > 0}
                data-count={count}
                onClick={() => cycle(chip.kind)}
                className={cn(
                  'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-body font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  count > 0
                    ? 'border-ink bg-ink text-primary-foreground'
                    : 'border-line bg-card text-ink hover:bg-muted',
                )}
              >
                {count > 0 ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Plus className="size-3.5" aria-hidden="true" />
                )}
                {t(`planEditor.rows.${chip.labelKey}`)}
                {count === 2 && <span>×2</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-4 text-body text-muted-foreground">
        {onCopyMeals && (
          <>
            <Copy className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {t('planEditor.picker.copyPrefix')}{' '}
              <button
                type="button"
                onClick={onCopyMeals}
                className="cursor-pointer font-semibold text-ink underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t('planEditor.picker.copyLink')}
              </button>
            </span>
          </>
        )}
        <button
          type="button"
          disabled={kinds.length === 0}
          onClick={() => onDone(kinds)}
          className="ml-auto rounded-lg bg-ink px-4 py-2 text-body font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('planEditor.picker.doneCount', { total: kinds.length })}
        </button>
      </div>
    </section>
  );
}
